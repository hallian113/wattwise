"""Energy arithmetic and the monthly projection (no database here)."""
from datetime import datetime

from . import tariff as tf


def trapezoid_wh(p_prev: float, p_cur: float, dt_s: float, max_gap_s: float):
    """Energy in Wh between two readings, or None if the gap is not usable.

    Power is averaged over the interval (trapezoid rule). A gap longer than
    max_gap_s (Wi-Fi drop, node off) is not counted, because nobody measured it.
    """
    if dt_s <= 0 or dt_s > max_gap_s:
        return None
    return (p_prev + p_cur) / 2.0 * dt_s / 3600.0


def summarize(hourly_rows, tz, tariff: dict, as_of_local: datetime) -> dict:
    """Totals for one day from hourly rows [(hour_start, wh, seconds_of_data), ...].

    peak_vs_average compares the average power during the peak with the average
    power over all the time that was actually measured (seconds_of_data), so a
    gap with no readings cannot distort it. It is left out unless the data
    holds at least 30 minutes of peak AND at least 1 hour outside the peak.
    """
    rows = [(r[0], r[1], r[2] if len(r) > 2 else 0.0) for r in hourly_rows]
    total = sum(r[1] for r in rows)
    peak, off = tf.split_hourly(rows, tz, tariff)
    peak_s = sum(sec for h, _, sec in rows if tf.is_peak(h.astimezone(tz), tariff))
    total_s = sum(sec for _, _, sec in rows)
    intensity = None
    if peak > 0 and total > 0 and peak_s >= 1800 and (total_s - peak_s) >= 3600:
        intensity = (peak / peak_s) / (total / total_s)
    return {
        "total_units": total / 1000.0,
        "peak_units": peak / 1000.0,
        "offpeak_units": off / 1000.0,
        "peak_share": (peak / total) if total > 0 else 0.0,
        "peak_vs_average": intensity,
        "cost_pkr": tf.cost(peak, off, tariff),
        "peak_window": list(tf.peak_window(as_of_local, tariff)),
    }


def project_cycle(measured_units_so_far: float, days_elapsed: float, bill: dict) -> dict:
    """Month projection from the two numbers on the bill.

    rest_daily is last month's total spread over the cycle. It slightly
    over-states the rest of the house (last month's total also contains the
    appliances we measure), which is stated on the dashboard. The +/-12% range
    is a rule of thumb, not a statistical interval.
    """
    cycle_days = float(bill.get("cycle_days") or 30)
    limit = bill.get("limit_units")
    last = bill.get("last_month_units")
    out = {"available": False, "measured_units": measured_units_so_far, "limit_units": limit}
    if last is None:
        return out
    days_elapsed = max(0.0, min(days_elapsed, cycle_days))
    days_left = cycle_days - days_elapsed
    rest_daily = float(last) / cycle_days
    measured_daily = measured_units_so_far / days_elapsed if days_elapsed >= 0.05 else 0.0
    so_far = rest_daily * days_elapsed + measured_units_so_far
    projected = so_far + (rest_daily + measured_daily) * days_left
    low, high = projected * 0.88, projected * 1.12
    left = (limit - so_far) if limit else None
    status = "ok"
    if limit:
        if so_far > limit:
            status = "over"
        elif projected >= 0.95 * limit or (left is not None and left <= 0.05 * limit):
            status = "near"
        elif high >= limit:
            status = "watch"
    out.update({
        "available": True,
        "estimated_units_so_far": so_far,
        "projected_units": projected,
        "range_low": low,
        "range_high": high,
        "units_left_to_limit": left,
        "days_left": days_left,
        "status": status,
    })
    return out
