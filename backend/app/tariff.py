"""Peak / off-peak windows and cost.

The windows and rates below are EXAMPLES taken from public tariff notices and
they change over time and between distribution companies. Copy the real
values from your own bill into the settings (dashboard > Settings).
"""
from datetime import datetime, timedelta

DEFAULT_TARIFF = {
    # month number -> [peak start hour, peak end hour) in local time
    "peak_windows": {
        "1": [17, 21], "2": [17, 21], "3": [18, 22], "4": [18, 22], "5": [18, 22],
        "6": [19, 23], "7": [19, 23], "8": [19, 23],
        "9": [18, 22], "10": [18, 22], "11": [18, 22], "12": [17, 21],
    },
    "peak_rate": 46.85,      # PKR per unit, example
    "offpeak_rate": 40.53,   # PKR per unit, example
    "flat_rate": 40.0,       # PKR per unit, used where no split is needed (example)
    "note": "Example values. Replace them with the figures on your bill.",
}


def peak_window(local_dt: datetime, tariff: dict) -> tuple[int, int]:
    start, end = tariff["peak_windows"][str(local_dt.month)]
    return int(start), int(end)


def is_peak(local_dt: datetime, tariff: dict) -> bool:
    start, end = peak_window(local_dt, tariff)
    return start <= local_dt.hour < end


def split_hourly(rows, tz, tariff: dict) -> tuple[float, float]:
    """rows: iterable of (hour_start as aware datetime, wh). Returns (peak_wh, offpeak_wh)."""
    peak = off = 0.0
    for hour_start, wh in rows:
        local = hour_start.astimezone(tz)
        if is_peak(local, tariff):
            peak += wh
        else:
            off += wh
    return peak, off


def peak_hours_elapsed(local_dt: datetime, tariff: dict) -> float:
    """Hours of the day's peak window that have already passed at local_dt."""
    start, end = peak_window(local_dt, tariff)
    now_h = local_dt.hour + local_dt.minute / 60 + local_dt.second / 3600
    return max(0.0, min(now_h, end) - start)


def cost(peak_wh: float, offpeak_wh: float, tariff: dict) -> float:
    return peak_wh / 1000 * tariff["peak_rate"] + offpeak_wh / 1000 * tariff["offpeak_rate"]


def local_day_start(local_dt: datetime) -> datetime:
    return local_dt.replace(hour=0, minute=0, second=0, microsecond=0)


def next_day(local_dt: datetime) -> datetime:
    return local_day_start(local_dt) + timedelta(days=1)
