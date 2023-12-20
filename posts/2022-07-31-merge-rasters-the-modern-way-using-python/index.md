---
title: Merging Rasters using Rasterio
date: 2022-08-07
slug: merge-rasters-the-modern-way-using-python
categories: [Python]
tags: []
subtitle: ''
description: 'Use pystac-client to fetch and merge data. Also, understand the merge functionality of rasterio.'
authors: []
lastmod: '2022-08-07T10:55:30+05:30'
featured: no
image: featured.jpg
---

In this blog, we'll examine how to merge or mosaic rasters using Python, the modern way. Additionally, we would look at a few nuances and internal workings of rasterio's merge functionality along with saving your rasters in-memory.

By "modern way", it is implied that you have an improved workflow and data management. And that you can experiment with various scenarios quickly and efficiently.

The traditional way to mosaic data is by downloading multiple intersecting tileset in its entirety. Downloading an entire tileset is itself a cost prohibitive task, added to already lost time in searching desired satellite imagery on GUI.


To overcome these traditional challenges, there has been significant improvement in storing metadata of satellite imagery (namely [STAC](https://stacspec.org/en)) which has enabled querying them much smoother and made it imagery-provider agnostic.

### TL;DR

We would perform the following task in this blog —
- Use pystac to query items over our AOI
- Plot the tiles on map using hvplot
- Merge tiles without data download on local machine
- Save the merged tile in-memory using rasterio's MemoryFile
- Internals of rasterio's merge methods


---

### Problem at hand

I wish to access sentinel-2 True Color Image for the month of January over my area of interest (AOI), which is a highway network across Karnataka and Andhra Pradesh (Figure 1).



<figure>

![bokeh_plot](https://user-images.githubusercontent.com/76432265/183255775-352d47fb-515c-4d72-ba4e-e32ac5bebf42.png)

<figcaption align = "center"><b><i>Fig.1 -
Highway Network as our Region of Interest</ href> </i></b></figcaption>

</figure>


We start by fetching sentinel-2 tiles over our AOI from `sentinel-s2-l2a-cogs` STAC catalog using [pystac-client](https://github.com/stac-utils/pystac-client). This library allows us to crawl STAC catalog and enables rapid access to the metadata we need.

```python
# STAC API root URL
# Thanks to element84 for hosting the API for sentinel-2 catalog.
URL = 'https://earth-search.aws.element84.com/v0/'

client = Client.open(URL)

search = client.search(
    max_items = 10,
    collections = "sentinel-s2-l2a-cogs",
    bbox = gdf.total_bounds, # geodataframe for our region of study
    datetime = '2022-01-01/2022-01-24'
)
```
In the above code, we search for 10 sentinel-s2-l2a-cogs over our AOI for the date between January 1 and 24 of 2022.

Now we need to know which of our 10 queried images covers our area of interest in its entirety. To do that, we can plot all the search results on the map and visually inspect.


<figure>

![bokeh_plot](https://user-images.githubusercontent.com/76432265/183255939-121e585e-79dc-4ceb-b61e-7e08709de926.png)

<figcaption align = "center"><b><i>Fig.2 -
Sentinel-2 tiles overlaid on Region of Interest</ href> </i></b></figcaption>

</figure>



We see that our AOI is not covered by a single tile in entirety, and that there is a need to merge adjacent tiles.


> Note that we have so far only queried the metadata of our desired imagery

We use rasterio's [merge](https://rasterio.readthedocs.io/en/latest/api/rasterio.merge.html) functionality, which would enable us to combine all of them seamlessly.

First, we get all the tiles for a single day and look for True Color Image (TCI) band

```sh
# retrieve the items as dictionaries, rather than Item objects
items = list(search.items_as_dicts())
# convert found items to a GeoDataFrame
items_gdf = items_to_geodataframe(items)

tiles_single_day = items_gdf.loc['2022-01-23', "assets.visual.href"]

# print(tiles_single_day)
 properties.datetime
 2022-01-23 05:25:14+00:00    https://sentinel-cogs.s3.us-west-2.amazonaws.c...
 2022-01-23 05:25:11+00:00    https://sentinel-cogs.s3.us-west-2.amazonaws.c...
 2022-01-23 05:24:59+00:00    https://sentinel-cogs.s3.us-west-2.amazonaws.c...
 2022-01-23 05:24:56+00:00    https://sentinel-cogs.s3.us-west-2.amazonaws.c...
 Name: assets.visual.href, dtype: object

```


Next, read the remote files via the URL in the above output using `rasterio.open` and save the returned file handlers as a list. This is the first instance where we are dealing with the actual imagery. Although, we are not reading the values stored in the data just yet.

```py
# open images stored on s3
file_handler = [rasterio.open(row) for row in tiles_single_day]
```

Finally we can merge all of the tiles and get the clipped raster stored in memory. 

```py
from rasterio.io import MemoryFile
from rasterio.merge import merge

memfile = MemoryFile()

merge(datasets=file_handler, # list of dataset objects opened in 'r' mode
    bounds=tuple(gdf.set_crs("EPSG:4326").to_crs(file_handler[0].crs).total_bounds), # tuple
    nodata=None, # float
    dtype='uint16', # dtype
    resampling=Resampling.nearest,
    method='first', # strategy to combine overlapping rasters
    dst_path=memfile.name, # str or PathLike to save raster
    dst_kwds={'blockysize':512, 'blockxsize':512} # Dictionary
  )
```

There are really interesting things to look at in the above code. Overall, the code above returns a `MemoryFile` object which contains a `uint16` raster with bounds of our AOI and blocksize of 512. The attribute `dst_path` allows us to specify a path to save the output as a raster. What is interesting is we can not only pass a file path to save on local disk but also a virtual path and save the merged raster **in-memory**, avoiding clutter of additional files on disk.

To define a virtual path, we use rasterio's `MemoryFile` class. When we create a `MemoryFile` object, it has a `name` attribute which gives us a virtual path, thus treating it as a real file (using GDALs [vsimem](https://gdal.org/user/virtual_file_systems.html#vsimem-in-memory-files) internally). This MemoryFile object (`memfile` here) provides us all the methods and attributes of rasterio's file handler, which is extremely helpful.


```py
print(memfile.open().profile)

{'driver': 'GTiff', 'dtype': 'uint16', 'nodata': 0.0, 'width': 4110, 'height': 3211, 'count': 3, 'crs': CRS.from_epsg(32643), 'transform': Affine(10.0, 0.0, 788693.4700669964,
       0.0, -10.0, 1500674.3670768766), 'blockxsize': 512, 'blockysize': 512, 'tiled': True, 'compress': 'deflate', 'interleave': 'pixel'}

```

The `method='first'` tells us the strategy used to determine the value of the pixel where the rasters overlap. In this case, the pixel value from the first imagery of the overlapping region in the list, is used as the value for the output raster.

The entire algorithm to merge rasters is illustrated in the figure below by taking an example of combining two rasters with `method=first`.

<figure>

![merge-rasterio-with-laberl_merging-rasters](https://user-images.githubusercontent.com/76432265/183279200-05b96cd5-f0a7-48e0-9b37-480792756d16.jpg)

<figcaption align = "center"><b><i>Fig.3 -
Internal working of rasterio's merge functionality. src1 and src2 are two overlapping raster.</ href> </i></b></figcaption>


</figure>

From the above figure, for each raster in the list:
- it finds the intersection with the **Output Bounds** (named `region` in the figure)

- next, it gets a boolean mask of invaild pixel over the `region` (named `region_mask` in the figure). 


- next, it copies over all the existing values from the raster for the `region` to an array (named `temp` in the figure)

- It gets a boolean mask for the valid pixels in the `temp` array. (named `temp_mask` in the figure)

- With these four arrays, it runs the `method=first`, which is to
  - create the same shaped array as that of `region` and fill values with negation of `region_mask` (named `A` in the figure)
  - create a filter by combining `region_mask` and `A` with a AND gate (named `B` in the figure)
  - copy over the values from `temp` to `region` using `B` as the filter

These series of steps are performed for all the rasters in the list. Finally, the output at the end of each iteration is combined to produce `dest` raster. 

> Notice the dark strip bands for each array which represents the overlapping region. Also notice that values from the dark strip in step **`1`** did not change at the end of step **`2`** 

---


### Custom combining strategy for overlapping regions


We can have arbitrary conditions on how to combine the overlapping region. By default rasterio uses values of the first overlapping raster from the list of Input files as pixel values for the output raster file. It has several other options in its utility such as `min`, `max`, `sum`, `count`, `last`.

To define our custom method, say in this case, I want to take the average of all the pixel values over my overlapping region and copy them to the output file. To do that, we can override the method by defining our custom method. Let us see how —

We take a look at the source code of built-in methods which make use of two or more rasters to make decisions on the output pixel values. Few such methods which do that are `copy_sum`, `copy_min`, `copy_max`, `copy_count`.


Looking at the [copy_min](https://github.com/rasterio/rasterio/blob/main/rasterio/merge.py#L40) from source code, we see that it performs two logical operations each before and after the custom logic we wish to apply.


<figure>

![image](https://user-images.githubusercontent.com/76432265/183279064-f2437364-b4bd-4761-8b99-2aa3bc65bc42.png)

<figcaption align = "center"><b><i>Fig.4 -
copy_min function copies minimum value from overlapping region to the output raster</ href> </i></b></figcaption>

</figure>



We would replace our custom logic of averaging with that of `minimum` in the above code and that is all there is to it. We can now use this function to manipulate the values of overlapping region!

```py
def custom_method_avg(merged_data, new_data, merged_mask, new_mask, **kwargs):
    """Returns the average value pixel."""
    mask = np.empty_like(merged_mask, dtype="bool")
    np.logical_or(merged_mask, new_mask, out=mask)
    np.logical_not(mask, out=mask)
    np.nanmean([merged_data, new_data], axis=0, out=merged_data, where=mask)
    np.logical_not(new_mask, out=mask)
    np.logical_and(merged_mask, mask, out=mask)
    np.copyto(merged_data, new_data, where=mask, casting="unsafe")
```




---

### Endnote

The modern approach to merge rasters in python is to only stream the data for your region of interest, process and perform analysis on the raster in memory. This would save you a huge cost and time. This is possible because of [COGs](https://www.cogeo.org/) and [STAC](https://stacspec.org/en).

We looked at the merge method in depth and also explored the techniques used to combine the overlapping data. Finally, we created a custom method for merging rasters by modifying the existing code to suit our requirements. The code associated with this post can be found [here](https://colab.research.google.com/drive/1iMYdNmAEr0JuKzPnDH0qC4rDsYkvwMk0?usp=sharing).
