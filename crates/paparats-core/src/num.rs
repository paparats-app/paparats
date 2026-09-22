//! TypeScript mapping for floats.
//!
//! specta exports `f64` as `number | null` because JSON turns `NaN`/`Infinity` into `null`. Our
//! floats (sizes, progress, prices) are always finite, so fields opt into a plain `number` with
//! `#[specta(type = crate::Num)]`.

use specta::{Type, Types, datatype::DataType};

/// Marker type exported to TypeScript as `number`.
pub struct Num;

impl Type for Num {
    fn definition(types: &mut Types) -> DataType {
        <i32 as Type>::definition(types)
    }
}
