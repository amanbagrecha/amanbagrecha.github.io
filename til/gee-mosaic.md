---
title: "Min-Max Normalization"
date: "2025-11-07"
categories: ['gee', 'image-processing']
---

TIL that when we download large tiles from google earth engine, it shards it into multiple images and each image has its own min-max, and it streches it to that min-max and then lets us download.

The result is visible discontinuities when visualizing the mosaicked image, even though the underlying data is spatially continuous. 

We can get back the seemless-mosaic by simply normalising using global min-max.

```python
import numpy as np
import rasterio
from rasterio.merge import merge
from pathlib import Path

shard_files = ['file1.tif', 'file2.tif']

datasets = [rasterio.open(f) for f in shard_files]
mosaic, transform = merge(datasets)

global_min = np.nanmin(mosaic)
global_max = np.nanmax(mosaic)

normalized = (mosaic - global_min) / (global_max - global_min)

profile = datasets[0].profile.copy()
profile.update({
    'dtype': 'float32',
    'height': normalized.shape[1],
    'width': normalized.shape[2],
    'transform': transform,
    'driver': 'COG'
})

with rasterio.open('normalized_mosaic.tif', 'w', **profile) as dst:
    dst.write(normalized)

[d.close() for d in datasets]
```

Similar to this issue mentioned in [stackoverflow](https://gis.stackexchange.com/questions/490449/why-is-there-a-color-difference-problem-in-the-mosaic-of-sentinel-2-images-from)

I also experimented with if we should use local min-max normalisation or global, and for this use case a global normalisation makes sense since it was originally part of one tile.

You can check out the artifact [here](https://claude.ai/public/artifacts/76501e96-a650-4a23-867f-2e531ac05902)