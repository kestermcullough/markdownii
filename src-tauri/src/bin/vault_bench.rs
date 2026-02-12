use markdownii::vault_tree::{count_tree_stats, scan_markdown_tree};
use std::path::PathBuf;
use std::time::Instant;

fn parse_args() -> Result<(PathBuf, usize), String> {
    let mut args = std::env::args().skip(1);
    let root = args
        .next()
        .ok_or_else(|| "usage: cargo run --bin vault_bench -- <vault-path> [iterations]".to_string())?;
    let iterations = args
        .next()
        .map(|raw| raw.parse::<usize>().map_err(|e| e.to_string()))
        .transpose()?
        .unwrap_or(8);
    if iterations == 0 {
        return Err("iterations must be >= 1".to_string());
    }
    Ok((PathBuf::from(root), iterations))
}

fn main() {
    let (root, iterations) = match parse_args() {
        Ok(parsed) => parsed,
        Err(err) => {
            eprintln!("{err}");
            std::process::exit(2);
        }
    };

    if !root.is_dir() {
        eprintln!("path is not a directory: {}", root.display());
        std::process::exit(2);
    }

    let warmup_start = Instant::now();
    let warmup_tree = match scan_markdown_tree(&root) {
        Ok(tree) => tree,
        Err(err) => {
            eprintln!("scan failed during warmup: {err}");
            std::process::exit(1);
        }
    };
    let warmup_ms = warmup_start.elapsed().as_secs_f64() * 1000.0;
    let (files, dirs) = count_tree_stats(&warmup_tree);

    let mut samples_ms = Vec::with_capacity(iterations);
    for _ in 0..iterations {
        let start = Instant::now();
        if let Err(err) = scan_markdown_tree(&root) {
            eprintln!("scan failed: {err}");
            std::process::exit(1);
        }
        samples_ms.push(start.elapsed().as_secs_f64() * 1000.0);
    }

    let sum = samples_ms.iter().sum::<f64>();
    let avg = sum / samples_ms.len() as f64;
    let min = samples_ms
        .iter()
        .copied()
        .fold(f64::INFINITY, |acc, value| acc.min(value));
    let max = samples_ms
        .iter()
        .copied()
        .fold(f64::NEG_INFINITY, |acc, value| acc.max(value));

    println!("vault bench: {}", root.display());
    println!("iterations: {iterations}");
    println!("warmup_ms: {:.2}", warmup_ms);
    println!("markdown_files: {files}");
    println!("directories: {dirs}");
    println!("avg_ms: {:.2}", avg);
    println!("min_ms: {:.2}", min);
    println!("max_ms: {:.2}", max);
    println!(
        "samples_ms: [{}]",
        samples_ms
            .iter()
            .map(|v| format!("{v:.2}"))
            .collect::<Vec<_>>()
            .join(", ")
    );
}
