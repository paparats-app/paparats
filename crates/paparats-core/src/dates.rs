//! Calendar arithmetic on `YYYY-MM-DD` dates (local calendar days, no time zones). Mirrors the
//! UI's `domain/dates.ts` so both sides stamp the same renewal, gift and outage dates.

use chrono::{Datelike, Days, Months, NaiveDate};

use crate::IsoDate;

/// A string that is not a valid `YYYY-MM-DD` calendar date, or arithmetic that left the range.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("not a valid YYYY-MM-DD date: {0:?}")]
pub struct DateError(pub String);

/// Parses a strict `YYYY-MM-DD` date.
pub fn parse(iso: &str) -> Result<NaiveDate, DateError> {
    let invalid = || DateError(iso.to_owned());
    let mut parts = iso.split('-');
    let (Some(y), Some(m), Some(d), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(invalid());
    };
    let digits = |s: &str, len: usize| s.len() == len && s.bytes().all(|b| b.is_ascii_digit());
    if !digits(y, 4) || !digits(m, 2) || !digits(d, 2) {
        return Err(invalid());
    }
    let year: i32 = y.parse().map_err(|_| invalid())?;
    let month: u32 = m.parse().map_err(|_| invalid())?;
    let day: u32 = d.parse().map_err(|_| invalid())?;
    NaiveDate::from_ymd_opt(year, month, day).ok_or_else(invalid)
}

/// Formats a date as `YYYY-MM-DD`.
pub fn format(date: NaiveDate) -> IsoDate {
    format!("{:04}-{:02}-{:02}", date.year(), date.month(), date.day())
}

/// `iso` plus `days` (negative goes back).
pub fn add_days(iso: &str, days: i64) -> Result<IsoDate, DateError> {
    let date = parse(iso)?;
    let shifted = if days >= 0 {
        date.checked_add_days(Days::new(days.unsigned_abs()))
    } else {
        date.checked_sub_days(Days::new(days.unsigned_abs()))
    };
    shifted.map(format).ok_or_else(|| DateError(iso.to_owned()))
}

/// Calendar months; the day is clamped to the target month (Jan 31 + 1 → Feb 28).
pub fn add_months(iso: &str, months: u32) -> Result<IsoDate, DateError> {
    parse(iso)?
        .checked_add_months(Months::new(months))
        .map(format)
        .ok_or_else(|| DateError(iso.to_owned()))
}

/// Calendar years (Feb 29 + 1 → Feb 28).
pub fn add_years(iso: &str, years: u32) -> Result<IsoDate, DateError> {
    let months = years
        .checked_mul(12)
        .ok_or_else(|| DateError(iso.to_owned()))?;
    add_months(iso, months)
}

/// Whole days from `from` to `to` (negative when `to` is earlier).
pub fn days_between(from: &str, to: &str) -> Result<i64, DateError> {
    Ok((parse(to)? - parse(from)?).num_days())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_formats_strictly() {
        let d = parse("2026-09-15").unwrap();
        assert_eq!(format(d), "2026-09-15");
        for bad in [
            "",
            "2026-9-15",
            "2026-09-31",
            "26-09-15",
            "2026-09-15x",
            "2026/09/15",
            "2026-0a-15",
        ] {
            assert!(parse(bad).is_err(), "{bad:?} should be rejected");
        }
    }

    #[test]
    fn months_clamp_to_the_end_of_the_month() {
        assert_eq!(add_months("2026-09-15", 1).unwrap(), "2026-10-15");
        assert_eq!(add_months("2026-09-15", 3).unwrap(), "2026-12-15");
        assert_eq!(add_months("2026-01-31", 1).unwrap(), "2026-02-28");
        assert_eq!(add_months("2026-11-30", 3).unwrap(), "2027-02-28");
        assert_eq!(add_years("2026-09-15", 1).unwrap(), "2027-09-15");
        assert_eq!(add_years("2028-02-29", 1).unwrap(), "2029-02-28");
    }

    #[test]
    fn day_arithmetic() {
        assert_eq!(days_between("2026-08-30", "2026-09-15").unwrap(), 16);
        assert_eq!(days_between("2026-09-15", "2026-08-30").unwrap(), -16);
        assert_eq!(add_days("2026-09-15", 20).unwrap(), "2026-10-05");
        assert_eq!(add_days("2026-03-01", -1).unwrap(), "2026-02-28");
    }
}
