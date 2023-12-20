---
title: Polygonize Raster and Compute Zonal-Statistics in Python
date: 2021-09-30
slug: polygonize-raster-and-compute-zonal-stats-in-python
categories: [GDAL, Python]
tags: [GDAL, Python]
subtitle: ''
description: 'Computing zonal statistics over raster using GDAL and Python'
authors: []
lastmod: '2021-10-09T18:51:08+05:30'
featured: no
projects: []
---

The output of a clustering algorithm is a raster. But when you want to compute statistics of the clustered raster, it needs to be polygonized.  
 

A simple way to perform this action is using the gdal command line `gdal_polygonize.py` script. This script requires the output file format, input raster file and output name of the vector file. You can additionally mask pixel values which you don't want to convert to polygons. For this example, we would consider a single band image.


```shell
python gdal_polygonize.py raster_file -f "ESRI Shapefile" vector_file.shp  layername atrributefieldname
```
`--nomask` allows to include nodata values in the shapefile

`atrributefieldname` should always be preceded with `layername` else it would result in an error.

The output would result in a vector layer. The number of output polygons is equal to the number of non-NA values. Each neighbouring cell (pixel) which is connected in the raster having the same value is combined to form a single polygon.

For instance, consider this 4 x 4 raster. When converted to vector, it resulted in 6 polygons. Note that disconnected similar values form an independent polygon. Each polygon will have an attribute as its pixel value from the raster, in the data type of the image. These would end up being a pair of (polygon, value) for each feature found in the image.


<figure>

![](https://i.imgur.com/xeJ4BGa.png)
<figcaption align = "center"><b><i>Fig.1 -Converting Raster to Vector using GDAL. The output polygon has attribute associated with its raster value </i></b></figcaption>

</figure>


Another way to polygonize raster programmatically is to use the `rasterio` library. Since rasterio utilizes GDAL under the hood, it also performs similar action and results in a pair of geometry and raster value. We create a tuple of dictionaries to store each feature output.


```python
# code to polygonize using rasterio
from rasterio import features

# read the raster and polygonize
with rasterio.open(cluster_image_path) as src:
    image = src.read(1, out_dtype='uint16') 
    #Make a mask!
    mask = image != 0
# `results` contains a tuple. With each element in the tuple representing a dictionary containing the feature (polygon) and its associated raster value
results = ( {'properties': {'cluster_id': int(v)}, 'geometry': s} 
            for (s, v) in (features.shapes(image, mask=mask, transform=src.transform)))
```

Once we have the raster polygonized, we can use `rasterstats` library to calculate zonal statistics. We use this library since there is no in-built functionality for rasterio to calculate it.

This library has a function `zonal_stats` which takes in a vector layer and a raster to calculate the zonal statistics. Read more [here](https://pythonhosted.org/rasterstats/manual.html#zonal-statistics) 

The parameters to the function are:

1. vectors: path to an vector source or geo-like python objects
2. raster: ndarray or path to a GDAL raster source

and various other options which can be found [here](https://github.com/perrygeo/python-rasterstats/blob/master/src/rasterstats/main.py#L34) 

To create a vector layer from the tuple `results`, we use geopandas. There are other libraries (such as fiona) which can also create vector geometry from shapely objects. 

For raster, we pass the `.tif` file directly to `zonal_stats`. The final code looks like the following


```python
from rasterstats import zonal_stats

in_shp = gpd.GeoDataFrame.from_features(results).set_crs(crs=src.crs)

# stats parameter takes in various statistics that needs to be computed 
statistics= zonal_stats(in_shp,image,stats='min, max, mean, median',
                geojson_out=True, nodata = -999)
```
The output is a geojson generator when `geojson_out` is True. we can convert the geojson to dataframe and export as csv for further processing.


This way, with the help of geopandas, rasterstats and rasterio, we polygonize the raster and calculate zonal statistics.
