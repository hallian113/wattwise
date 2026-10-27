-- Clears all readings, energy totals, sessions and events. Settings and appliances stay.
-- Run it in pgAdmin (Query Tool on the wattwise database) between demonstrations.
TRUNCATE power_readings, room_readings, energy_hourly, sessions, events RESTART IDENTITY;
