# Notebooks

This directory contains interactive Jupyter notebooks documenting learnings, experiments, and explorations.

## Structure

Each notebook should be in its own subdirectory with an `index.ipynb` file:

```
notebooks/
├── index.qmd                    # Auto-generated listing page
├── _metadata.yml                # Shared settings for all notebooks
├── notebook-topic-1/
│   ├── index.ipynb             # Main notebook
│   └── data/                   # Optional: data files
└── notebook-topic-2/
    ├── index.ipynb
    └── images/                 # Optional: images
```

## Adding a New Notebook

1. Create a new directory: `notebooks/your-notebook-name/`
2. Add your notebook as `index.ipynb`
3. Include metadata in the first raw cell:

```yaml
---
title: "Your Notebook Title"
date: "2025-11-12"
description: "Brief description"
categories: [python, geospatial, data-science]
draft: false
---
```

4. The notebook will automatically appear on the Notebooks listing page

## Notebook Settings

Default settings are in `_metadata.yml`:
- `freeze: auto` - Only re-executes when source changes
- `code-fold: show` - Code visible but collapsible
- `code-tools: true` - Adds download source button
- `code-copy: hover` - Easy code copying

## Tips

- Keep notebooks focused on a single topic
- Use descriptive directory names (e.g., `gpm-imerg-analysis`, `raster-processing`)
- Add categories for easy filtering
- Set `draft: true` for work-in-progress notebooks
