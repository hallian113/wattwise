from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app import analytics, tariff as tf
from app.states import DEFAULT_THRESHOLDS as TH, StateTracker

TZ = ZoneInfo("Asia/Karachi")
T0 = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)


def test_trapezoid_energy():
    # 45 W for one hour is 45 Wh
    assert analytics.trapezoid_wh(45, 45, 3600, 7200) == pytest.approx(45.0)
    # the average of 10 W and 30 W for 1 second
    assert analytics.trapezoid_wh(10, 30, 1, 120) == pytest.approx(20 / 3600)


def test_gap_is_not_counted():
    assert analytics.trapezoid_wh(100, 100, 300, 120) is None
    assert analytics.trapezoid_wh(100, 100, 0, 120) is None
    assert analytics.trapezoid_wh(100, 100, -5, 120) is None


def test_peak_windows_follow_the_season():
    t = tf.DEFAULT_TARIFF
    assert tf.peak_window(datetime(2026, 12, 15, 12, tzinfo=TZ), t) == (17, 21)
    assert tf.peak_window(datetime(2026, 7, 15, 12, tzinfo=TZ), t) == (19, 23)
    assert tf.is_peak(datetime(2026, 11, 5, 19, 30, tzinfo=TZ), t)
    assert not tf.is_peak(datetime(2026, 11, 5, 22, 0, tzinfo=TZ), t)   # end hour is excluded
    assert not tf.is_peak(datetime(2026, 11, 5, 17, 59, tzinfo=TZ), t)


def test_split_and_cost():
    t = tf.DEFAULT_TARIFF
    # 17:00 UTC is 22:00 in Karachi (off-peak), 14:00 UTC is 19:00 (peak, November 18-22)
    rows = [(datetime(2026, 11, 5, 14, tzinfo=timezone.utc), 100.0),
            (datetime(2026, 11, 5, 17, tzinfo=timezone.utc), 300.0)]
    peak, off = tf.split_hourly(rows, TZ, t)
    assert (peak, off) == (100.0, 300.0)
    assert tf.cost(peak, off, t) == pytest.approx(0.1 * 46.85 + 0.3 * 40.53)


def hour(h_utc, wh, seconds=3600.0):
    return (datetime(2026, 11, 5, h_utc, tzinfo=timezone.utc), wh, seconds)


def test_summary_shares_and_intensity():
    t = tf.DEFAULT_TARIFF
    # 13:00 and 14:00 UTC are 18:00 and 19:00 local: peak. 5:00 and 6:00 UTC are 10:00 and 11:00 local: off-peak.
    rows = [hour(13, 100), hour(14, 100), hour(5, 20), hour(6, 20)]
    s = analytics.summarize(rows, TZ, t, datetime(2026, 11, 5, 20, 0, tzinfo=TZ))
    assert s["total_units"] == pytest.approx(0.24)
    assert s["peak_share"] == pytest.approx(200 / 240)
    # peak: 200 Wh in 7200 s = 100 W. All measured time: 240 Wh in 14400 s = 60 W.
    assert s["peak_vs_average"] == pytest.approx(100 / 60)


def test_intensity_is_left_out_when_there_is_no_off_peak_data():
    t = tf.DEFAULT_TARIFF
    s = analytics.summarize([hour(13, 100)], TZ, t, datetime(2026, 11, 5, 19, 0, tzinfo=TZ))
    assert s["peak_share"] == pytest.approx(1.0)
    assert s["peak_vs_average"] is None


def test_a_gap_with_no_readings_cannot_inflate_the_intensity():
    t = tf.DEFAULT_TARIFF
    # 10 minutes of data at 14:50, and 10 minutes at 18:30. The hours in between had no readings.
    rows = [(datetime(2026, 11, 5, 9, tzinfo=timezone.utc), 8.0, 600.0), (datetime(2026, 11, 5, 13, tzinfo=timezone.utc), 8.0, 600.0)]
    s = analytics.summarize(rows, TZ, t, datetime(2026, 11, 5, 18, 40, tzinfo=TZ))
    assert s["peak_vs_average"] is None


def test_projection_matches_hand_calculation():
    bill = {"cycle_days": 30, "limit_units": 200, "last_month_units": 240}
    p = analytics.project_cycle(measured_units_so_far=6.0, days_elapsed=10, bill=bill)
    # rest 8/day*10 = 80, plus measured 6 -> 86 so far; measured 0.6/day
    assert p["estimated_units_so_far"] == pytest.approx(86.0)
    assert p["projected_units"] == pytest.approx(86 + (8 + 0.6) * 20)
    assert p["status"] in ("near", "watch", "ok", "over")
    assert p["units_left_to_limit"] == pytest.approx(114.0)


def test_projection_status_levels():
    bill = {"cycle_days": 30, "limit_units": 200, "last_month_units": 195}
    assert analytics.project_cycle(0, 29, bill)["status"] == "near"
    assert analytics.project_cycle(0, 5, {**bill, "last_month_units": 100})["status"] == "ok"
    assert analytics.project_cycle(50, 29, {**bill, "last_month_units": 240})["status"] == "over"
    assert analytics.project_cycle(0, 5, {**bill, "last_month_units": None})["available"] is False


def feed(tracker, values, start=T0, step=1):
    changes = []
    for i, p in enumerate(values):
        if tracker.update(start + timedelta(seconds=i * step), p, TH):
            changes.append((i, tracker.state))
    return changes


def test_laptop_goes_from_charging_to_full_still_on():
    tr = StateTracker("laptop")
    changes = feed(tr, [45] * 10 + [15] * 10)
    states = [s for _, s in changes]
    assert states == ["high", "full_idle"]
    assert tr.wasting_power()


def test_laptop_idle_without_charging_is_plain_idle():
    tr = StateTracker("laptop")
    feed(tr, [15] * 10)
    assert tr.state == "idle"


def test_laptop_sleep_and_unplug():
    tr = StateTracker("laptop")
    feed(tr, [45] * 5 + [2] * 5 + [0] * 5)
    assert tr.state == "off"
    assert not tr.wasting_power()


def test_single_noisy_reading_does_not_flip_the_state():
    tr = StateTracker("laptop")
    feed(tr, [45] * 8 + [10] + [45] * 8)
    assert tr.state == "high"


def test_projector_states():
    tr = StateTracker("projector")
    changes = feed(tr, [1] * 6 + [240] * 6 + [30] * 6 + [1] * 6)
    assert [s for _, s in changes] == ["standby", "on", "cooling", "standby"]
