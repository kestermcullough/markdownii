use serde::Serialize;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}

pub fn scan_markdown_tree(root: &Path) -> Result<Vec<FileEntry>, String> {
    read_dir_recursive(root)
}

pub fn count_tree_stats(entries: &[FileEntry]) -> (usize, usize) {
    let mut files = 0usize;
    let mut dirs = 0usize;

    for entry in entries {
        if entry.is_dir {
            dirs += 1;
            if let Some(children) = &entry.children {
                let (nested_files, nested_dirs) = count_tree_stats(children);
                files += nested_files;
                dirs += nested_dirs;
            }
        } else {
            files += 1;
        }
    }

    (files, dirs)
}

fn should_skip_directory(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "node_modules" | "target" | "dist" | "build"
    )
}

fn read_dir_recursive(dir: &Path) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();

    let read_dir = std::fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            if should_skip_directory(&name) {
                continue;
            }

            let children = read_dir_recursive(&path)?;
            if !children.is_empty() {
                entries.push(FileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    children: Some(children),
                });
            }
        } else if path.extension().is_some_and(|ext| ext == "md") {
            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock drift")
            .as_nanos();
        std::env::temp_dir().join(format!("markdownii-{name}-{}-{nonce}", std::process::id()))
    }

    fn touch(path: &Path) {
        std::fs::write(path, "x").expect("write fixture file");
    }

    fn collect_file_names(entries: &[FileEntry], out: &mut Vec<String>) {
        for entry in entries {
            if entry.is_dir {
                if let Some(children) = &entry.children {
                    collect_file_names(children, out);
                }
            } else {
                out.push(entry.name.clone());
            }
        }
    }

    #[test]
    fn scan_skips_hidden_and_ignored_directories() {
        let root = unique_temp_dir("scan-skips");
        std::fs::create_dir_all(root.join("notes")).expect("create notes dir");
        std::fs::create_dir_all(root.join("node_modules/pkg")).expect("create node_modules");
        std::fs::create_dir_all(root.join("target/build")).expect("create target");

        touch(&root.join("notes/todo.md"));
        touch(&root.join("notes/readme.txt"));
        touch(&root.join(".hidden.md"));
        touch(&root.join("node_modules/pkg/dep.md"));
        touch(&root.join("target/build/compiled.md"));

        let tree = scan_markdown_tree(&root).expect("scan tree");
        let mut names = Vec::new();
        collect_file_names(&tree, &mut names);

        assert!(names.contains(&"todo.md".to_string()));
        assert!(!names.contains(&".hidden.md".to_string()));
        assert!(!names.contains(&"dep.md".to_string()));
        assert!(!names.contains(&"compiled.md".to_string()));

        std::fs::remove_dir_all(root).expect("cleanup fixture");
    }

    #[test]
    fn scan_keeps_only_directories_with_markdown_descendants() {
        let root = unique_temp_dir("dir-filter");
        std::fs::create_dir_all(root.join("empty/sub")).expect("create empty dir");
        std::fs::create_dir_all(root.join("work/nested")).expect("create work dir");

        touch(&root.join("empty/sub/info.txt"));
        touch(&root.join("work/nested/plan.md"));

        let tree = scan_markdown_tree(&root).expect("scan tree");
        let names: Vec<String> = tree.iter().map(|entry| entry.name.clone()).collect();
        assert!(names.contains(&"work".to_string()));
        assert!(!names.contains(&"empty".to_string()));

        let (files, dirs) = count_tree_stats(&tree);
        assert_eq!(files, 1);
        assert_eq!(dirs, 2);

        std::fs::remove_dir_all(root).expect("cleanup fixture");
    }
}
