fn main() {
    // Anche il server senza finestra incorpora questi file tramite include_dir.
    // Le modifiche alla sola grafica devono produrre un nuovo eseguibile.
    println!("cargo:rerun-if-changed=../../web");
    println!("cargo:rerun-if-changed=../../games");
    #[cfg(feature = "desktop")]
    tauri_build::build();
}
