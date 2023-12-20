---
title: Overlay cropped raster with vector layer
date: 2021-09-19
slug: overlay-cropped-raster-with-vector-layer
categories: [Remote Sensing, Python]
tags: []
description: 'Plot cropped raster and vector layer on the same figure using rasterio and matplotlib'
lastmod: '2021-09-27T10:43:11+05:30'
featured: no
---

I recently faced a problem of having to plot "cropped raster" layer and a vector layer on the same axes. It is known that we first need to identify the spatial extent of each layer, having the same coordinate reference system.  
Rasterio does offer a plotting function `show` which can plot a raster layer with the correct spatial extent for you when we pass the dataset reader object. 

When we pass a reader object, the spatial extent is automatically read by `show` function.
```python
with rs.open(path_to_file, "r") as src:  # import rasterio as rs
    
    f, ax = plt.subplots(figsize=(9,9))
    _ = show(src, ax=ax)            # from rasterio.plot import show
    _ = vector_layer.plot(ax=ax)    # `vector_layer` is a geodataframe (geopandas)
```

<figure>

![](https://i.imgur.com/A33Vopw.png)

<figcaption align = "center"><b><i>Fig.1 -Overlay raster with vector layer. Notice the spatial extent</i></b></figcaption>

</figure>


Moreover, if we pass a numpy array to the `show` function,  the spatial extent of that array has to be explicitly passed using the `transform` parameter of the `show` function since the numpy array does not know the corner location of the raster and thus the plot would begin with x,y: 0,0 as shown below. 

```python
with rs.open(path_to_file, "r") as src:

    img = src.read(1) # img is a numpy array

    f, ax = plt.subplots(figsize=(9,9))
    _ = show(img, transform = src.transform, ax=ax)
    _ = vector_layer.plot(ax=ax)
```

But what if you want to plot a subset of the raster image, in the sense that you would like to slice the image arbitrarily and plot it. When you slice the image, the affine transformation is not the same anymore and thus plotting the sliced image would result in a plot having the spatial extent of the original image while the sliced image being magnified (Fig. 2).

```python
with rs.open(path_to_file, "r") as src:

    img = src.read(1)[1:-1,1:-1]

    f, ax = plt.subplots(figsize=(9,9))
    _ = show(img, transform = src.transform, ax=ax)
    _ = vector_layer.plot(ax=ax)
```

<figure>

![](https://i.imgur.com/ePTM6q0.png)

<figcaption align = "center"><b><i>Fig.2 - Overlaid cropped raster and vector layer with incorrect spatial extents</i></b></figcaption>

</figure>


To avert this problem, we need to find the new affine transformation of the cropped image. Luckily rasterio has a `window_transform`  method on the dataset reader which can compute the new transformation from the old one by passing the bounds of the layer. The `window_transform` function can either take a 2D N-D array indexer in the form of a tuple `((row_start, row_stop), (col_start, col_stop))` or provide offset as written in its [documentation](https://rasterio.readthedocs.io/en/latest/api/rasterio.windows.html)


## Cropped raster and vector overlay

The above method returns the new affine transformation, which can be passed to the `show` function for the numpy array through the `transform` parameter. We also change the read method instead of slicing the array by window parameter to maintain uniformity

```python
# load raster
with rs.open(path_to_file, "r") as src:
    # window =  (((row_start), (row_stop)), ((col_start), (col_stop)))
    img = src.read(1, window = ((1,-1), (1,-1)))
    f, ax = plt.subplots(figsize=(9,9))
    show(img, transform=src.window_transform(((1,-1), (1,-1))), ax=ax)

    _ = vector_layer.plot(ax=ax)
```

<figure>

![](https://i.imgur.com/uwVnq4z.png)

<figcaption align = "center"><b><i>Fig.3 - Overlay of cropped raster and vector. Notice the updated spatial extent </i></b></figcaption>

</figure>


The `show` method is helpful for plotting rasters or even RGB images for that matter. One of the differences with matplotlib's plotting is the order of axes. `show` expects it the bands to be the last axis while matplotlib, the first. It can also plot 4-band image, which is almost always the for satellite images.
While there is an `extent` paramter in matplotlib's plotting function, `show` function is much tidier and straight-forward to implement cropped raster and overlay vector layer on it.





