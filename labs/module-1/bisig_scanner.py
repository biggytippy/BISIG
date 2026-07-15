#!/usr/bin/env python3
import os
import sys
import subprocess
import py_compile
from datetime import datetime

# Workspace root
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REPORT_FILE = os.path.join(ROOT_DIR, "labs/module-1/bisig_report.md")

# Excluded folders
EXCLUDES = {".git", "node_modules", ".venv", "dist", "__pycache__", "dist-ssr", ".gemini"}

# ANSI Color Codes for terminal coloring
COLOR_GREEN = "\033[92m"
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_RESET = "\033[0m"

def check_file_status(path):
    """Diagnoses code syntax and readability, returning status info (msg, type)."""
    if path.endswith(".py"):
        try:
            py_compile.compile(path, doraise=True)
            return ("Good", "good")
        except py_compile.PyCompileError as e:
            err_line = "unknown"
            err_details = "Syntax Error"
            for line in str(e).split("\n"):
                if "File" in line and "line" in line:
                    parts = line.split(",")
                    for part in parts:
                        if "line" in part:
                            err_line = part.replace("line", "").strip()
                if not line.startswith(" ") and not line.startswith("File") and line.strip():
                    err_details = line.strip()
            return (f"Error: {err_details} at line {err_line}", "error")
            
    elif path.endswith(".js"):
        try:
            res = subprocess.run(["node", "--check", path], capture_output=True, text=True)
            if res.returncode == 0:
                return ("Good", "good")
            else:
                err_line = "unknown"
                err_details = "Syntax Error"
                lines = res.stderr.split("\n")
                if lines:
                    err_details = lines[0]
                for line in lines:
                    if ":" in line:
                        parts = line.split(":")
                        for p in parts:
                            if p.strip().isdigit():
                                err_line = p.strip()
                                break
                return (f"Error: {err_details} at line {err_line}", "error")
        except Exception:
            return ("Warning: Node syntax checker unavailable", "warning")
            
    else:
        try:
            with open(path, "rb") as f:
                f.read(1024)
            return ("Good", "good")
        except Exception as e:
            return (f"Error: Unreadable file - {str(e)}", "error")

def scan_tree(dir_path, prefix="", terminal_lines=None, markdown_lines=None, stats=None):
    """Recursively walks directories, building tree lines and collecting metric statistics."""
    if terminal_lines is None:
        terminal_lines = []
    if markdown_lines is None:
        markdown_lines = []
    if stats is None:
        stats = {"dirs": 0, "files": 0, "lines": 0, "good": 0, "error": 0, "warning": 0}
        
    try:
        entries = sorted(os.listdir(dir_path))
    except PermissionError:
        return terminal_lines, markdown_lines, stats
        
    filtered_entries = [e for e in entries if e not in EXCLUDES and not e.startswith(".")]
    count = len(filtered_entries)
    
    for i, entry in enumerate(filtered_entries):
        path = os.path.join(dir_path, entry)
        is_last = (i == count - 1)
        connector = "└── " if is_last else "├── "
        
        if os.path.isdir(path):
            stats["dirs"] += 1
            terminal_lines.append(f"{prefix}{connector}{entry}/")
            markdown_lines.append(f"{prefix}{connector}{entry}/")
            new_prefix = prefix + ("    " if is_last else "│   ")
            scan_tree(path, new_prefix, terminal_lines, markdown_lines, stats)
        else:
            stats["files"] += 1
            # Count lines of code in file dynamically
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    stats["lines"] += sum(1 for _ in f)
            except Exception:
                pass
                
            msg, status_type = check_file_status(path)
            stats[status_type] += 1
            
            # Format colored output for terminal
            if status_type == "good":
                term_status = f"{COLOR_GREEN}[{msg}]{COLOR_RESET}"
            elif status_type == "error":
                term_status = f"{COLOR_RED}[{msg}]{COLOR_RESET}"
            else:
                term_status = f"{COLOR_YELLOW}[{msg}]{COLOR_RESET}"
                
            # Format plain output for Markdown
            plain_status = f"[{msg}]"
            
            terminal_lines.append(f"{prefix}{connector}{entry} {term_status}")
            markdown_lines.append(f"{prefix}{connector}{entry} {plain_status}")
            
    return terminal_lines, markdown_lines, stats

def run_scanner():
    timestamp = datetime.now().isoformat()
    use_colors = sys.stdout.isatty()
    
    print(f"\nScanning workspace starting from: {ROOT_DIR}")
    print(f"Timestamp: {timestamp}\n")
    
    term_tree = [f". (Workspace Root)"]
    md_tree = [f". (Workspace Root)"]
    stats = {"dirs": 0, "files": 0, "lines": 0, "good": 0, "error": 0, "warning": 0}
    
    scan_tree(ROOT_DIR, "", term_tree, md_tree, stats)
    
    # Print tree to console
    for line in term_tree:
        if not use_colors:
            line = line.replace(COLOR_GREEN, "").replace(COLOR_RED, "").replace(COLOR_YELLOW, "").replace(COLOR_RESET, "")
        print(line)
        
    # Calculate build clean rate
    total_scanned = stats["good"] + stats["error"] + stats["warning"]
    clean_rate = (stats["good"] / total_scanned * 100) if total_scanned > 0 else 0
    
    # Console metrics output
    print("\n" + "="*60)
    print("              BISIG CODEBASE QUALITY METRICS")
    print("="*60)
    print(f"  Directories Scanned : {stats['dirs']}")
    print(f"  Files Scanned       : {stats['files']}")
    print(f"  Lines of Code (LoC) : {stats['lines']}")
    print(f"  Compilation Status  : {stats['good']} / {stats['files']} Passed")
    print(f"  Syntax Errors       : {stats['error']}")
    print(f"  Syntax Warnings     : {stats['warning']}")
    
    status_msg = "CLEAN" if stats["error"] == 0 else "DEGRADED"
    color_code = COLOR_GREEN if stats["error"] == 0 else COLOR_RED
    if use_colors:
        print(f"  Build Health        : {color_code}{status_msg} ({clean_rate:.1f}% passing){COLOR_RESET}")
    else:
        print(f"  Build Health        : {status_msg} ({clean_rate:.1f}% passing)")
    print("="*60 + "\n")
        
    # Write report
    with open(REPORT_FILE, "w") as f:
        f.write(f"# BISIG Directory Diagnostic Tree Report\n\n")
        f.write(f"*Generated dynamically at: {timestamp}*\n\n")
        f.write("This report displays the directory layout of the project, checking the syntax compiler and file integrity status for every file.\n\n")
        
        # Add summary stats in clean text block (No tables!)
        f.write("### Codebase Metrics Summary\n\n")
        f.write(f"* **Directories Scanned**: {stats['dirs']}\n")
        f.write(f"* **Files Scanned**: {stats['files']}\n")
        f.write(f"* **Lines of Code (LoC)**: {stats['lines']}\n")
        f.write(f"* **Build Health**: {status_msg} ({clean_rate:.1f}% passing)\n")
        f.write(f"* **Syntax Errors**: {stats['error']} | **Warnings**: {stats['warning']}\n\n")
        
        f.write("### Codebase Diagnostic Tree\n\n")
        f.write("```text\n")
        for line in md_tree:
            f.write(f"{line}\n")
        f.write("```\n")
        
    print(f"Diagnostic tree written to: {REPORT_FILE}\n")

if __name__ == "__main__":
    run_scanner()
