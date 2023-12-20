---
title: Cloud Native Composite, Subset and Processing of Satellite Imagery with STAC
  and Stackstac
date: 2023-01-14
slug: cloud-native-composite-subset-and-processing-of-satellite-imagery-with-stac-and-stackstac
categories: [Python]
tags: [xarray, STAC]
description: ''
image: featured.png
---


>If you wanted to collect all Sentinel satellite data for a given region of interest (ROI), say, for a given day or time frame - is there any simple way to do it? That means: Without having to download all the full images manually and cropping the ROI subset manually as well afterwards?

This, well articulated question, was the one which I was facing and made me ponder to think if we could do this using STAC and Python.

---

I had a road network layer over which I needed satellite imagery. The problem with my road network is that it has a large spatial extent, causing a single satellite imagery to not cover it entirely. Moreover, because of this large extent, I need two adjacent tiles to be in the same Coordinate Reference System.

<figure>

![](https://i.imgur.com/FHLQbBo.png)
<figcaption align = "center"><b><i>Fig.1 - Road network (in red) spanning multiple UTM Zones. Basemap from OSM.</i></b></figcaption>

</figure>


What I needed was,
- A way to aggregate all the adjacent tiles for a single day
- Convert to a single CRS on the fly
- Subset the data to my region
- Create a composite (merge) and perform analysis on the fly

It turns out Python (and its ecosystem of great geospatial packages) along with STAC allows us to do just that.

What is STAC?
> STAC (SpatioTemporal Asset Catalog) is an open-source specification for describing satellite imagery and the associated metadata.

We will use `stackstac`, which is a Python package for efficiently managing and analysing large amounts of satellite imagery data in a cloud computing environment.

First, we search through the sentinel-2 collection for our area of interest from element84 provided STAC endpoint.

```
from pystac_client import Client

URL = 'https://earth-search.aws.element84.com/v0/'

client = Client.open(URL)
```

```
search = client.search(
    max_items = 10,
    collections = "sentinel-s2-l2a-cogs",
    intersects = aoi_as_multiline,
    datetime = '2022-01-01/2022-01-24'
)
```

The resultant `search` object is passed to `stack` method on `stackstac` along with providing the destination CRS, the region of bounds and the assets required.

```
import stackstac

ds = stackstac.stack(search.get_all_items() ,  epsg=4326, assets=["B04", "B03", "B05"],
bounds_latlon= aoi_as_multiline.bounds )

```
The above line does a lot of things under the hood. It transforms the CRS of each tile from their native CRS to EPSG:4326. It also clips the tiles to our AOI. It also filters only 3 bands out of the possible 15 sentinel-2 bands. 
The output `ds` is a `xarray.DataArray` object and it is a known fact how much is possible with very little code in xarray.

As such, we can group by a date and mosaic those tiles very easily using xarray as shown below.

```
dsf = ds.groupby("time.date").median()
```

<figure>

![](https://i.imgur.com/BLCu4xs.png)
<figcaption align = "center"><b><i>Fig.2 - Our DataArray is 3.37GB with 4 dimensions (time, bands, x, y) respectively.</i></b></figcaption>

</figure>

Since xarray loads lazily, we did not perform any computation so far. But we can see how much data we are going to end up storing as shown in Figure 2.

When I run the `compute` method on the output, it does the computation in 4 minutes (here) i.e, processing ~3.5GB in 4 mins and computing the median across the dates.

```
res = dsf.compute()
```

At the end of this process, I have 4 images for each of the 4 dates, clipped to my region of interest in the CRS that I desire. 

---
The above method of processing large volume data is super handy and can be scaled very easily with cloud infrastructure. What is unique about this approach is that I did not have to download data, convert or know the CRS of each tile, worrying about the bounds of my region of interest.
Read more about how stackstac works [here](https://stackstac.readthedocs.io/).

The code can be found [here](https://colab.research.google.com/drive/1NcwW7S58PkZFnrGaCyOcA5uLTxymdbZl?usp=sharing).