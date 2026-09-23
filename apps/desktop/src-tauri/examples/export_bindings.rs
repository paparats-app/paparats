//! `pnpm specta` — regenerates `apps/desktop/src/bindings.ts` from the registered commands and
//! events without starting the app.

fn main() {
    if let Err(err) = paparats_desktop_lib::export_bindings() {
        eprintln!("failed to export TypeScript bindings: {err}");
        std::process::exit(1);
    }
    println!("wrote {}", paparats_desktop_lib::BINDINGS_PATH);
}
