---
title: Two ways to Programmatically change projection of raw CSV
date: 2021-09-30
slug: two-ways-to-change-projection-of-raw-csv
categories: [GDAL, Python]
tags: [GDAL, Python]
subtitle: ''
description: 'Change projection of CSV on-the-fly using GDAL, GeoPandas'
lastmod: '2021-10-10T18:42:47+05:30'
featured: no
projects: []
---

Often, field values are collected in the Geographic Coordinate Reference System as CSV or ASCII so that it can be universally used. But when you want to perform any kind of analysis on these values, there is a need to reproject them into a Projected Coordinate Reference System for the specific area. Although there are many ways that exist now with desktop GIS, these methods can be cumbersome if you have thousands of files to reproject. 

This task of reprojecting raw CSV can be accomplished using GDAL although it is not straightforward. It requires an indication of geographic data of a CSV file which is provided using VRT (GDAL virtual Raster). More advanced tools now exist which are either built on top of GDAL or are very similar. **GeoPandas** and **pyproj** are two such libraries which can help us reproject our raw CSV on-the-fly.

We first look at how this task can be accomplished using the GDAL command line.

### Reproject CSV using `ogr2ogr`

<figure>

![](https://i.imgur.com/Udf4gdV.png)
<figcaption align = "center"><b><i>Fig.1 — Raw <b style="color:red;">input.csv</b> with <b>lat</b> & <b>lon</b> geometry column </i></b></figcaption>

</figure>

This example shows using `ogr2ogr` to reproject the CRS of CSV file with the latitude, longitude coordinates stored as columns **lat**, **lon** in the `input.csv` file.
```sh
ogr2ogr -f CSV -lco GEOMETRY=AS_XY -t_srs EPSG:32644 output.csv input.vrt
```
Following is the explanation of the above command,

  1. `-lco GEOMETRY=AS_XY` : Layer creation option with XY columns added in output CSV.
  2. `input.vrt` : Input Virtual Raster file containing information about CSV and its geometry.
  3. `-t_srs EPSG:32644` : Set target CRS to EPSG:32644
  4. `-f CSV` : specify the output file format
  5. `output.csv` : output CSV with reprojected coordinates

In the above code, `input.vrt` is a GDAL virtual raster which has to be created prior to running the command. It points to the CSV file which has the location data stored as columns (lon, lat)

```xml
<!--input.vrt pointing to the input.csv-->
<OGRVRTDataSource> 
  <OGRVRTLayer name="input"> 
    <SrcDataSource>input.csv</SrcDataSource> 
    <GeometryType>wkbPoint</GeometryType> 
    <LayerSRS>EPSG:4326</LayerSRS> 
    <GeometryField encoding="PointFromColumns" x="lon" y="lat"/> 
  </OGRVRTLayer> 
</OGRVRTDataSource>
```

**But what does the above xml mean?**

The above xml is a virtual raster (VRT) which allows for lazy processing. Often, we have to save intermediary outputs on our local disk, which could potentially take a lot of space. To avoid that, VRT allows to store the processing in an xml encoding and performs all intermediary action at once, in the final step. 

  1. The first line `<OGRVRTDataSource>` is the root element. 
  2. `<OGRVRTLayer name="input">` corresponds with the `<SrcDataSource> input.csv </SrcDataSource>` and points to the `input.csv` file we want to reproject. 
  3. `<LayerSRS>EPSG:4326</LayerSRS>` specifies the CRS of our `input.csv` file. 
  4. `<GeometryType> wkbPoint </GeometryType>` is the format that coordinates are stored in. 
  5. Lastly, `<GeometryField encoding="PointFromColumns" x="lon" y="lat"/>` indicates the columns corresponding to lon and lat in csv. Read more about converting CSV to VRT [here](https://gdal.org/drivers/vector/csv.html#reading-csv-containing-spatial-information).

<figure>

![](https://i.imgur.com/HefHXvu.png)
<figcaption align = "center"><b><i>Fig.2 — Reprojecting CSV from EPSG:4326 to EPSG:32644 using GDAL </i></b></figcaption>

</figure>


Hence, by running the above GDAL command, we would be able to reproject our CSV. By writing a bash script, this method can be scaled to thousands of files. But the intermediary `VRT` file is messy to handle and it would be nice to avoid it. Luckily for us, there are libraries built on top of GDAL which would help us avoid the hassle of creating intermediary files.


## Using GeoPandas

With its simple and intuitive API, GeoPandas allows us to read, reproject CRS and write files on-the-fly. 

```python
in_path = './'
out_path = './output'
files= [f for f in os.listdir(in_path) if f.endswith('.csv')]
input_crs = 'EPSG:4326'
output_crs = 'EPSG:32644'

if not os.path.exists(out_path):
    os.mkdir(out_path)

for file in files:
    df = pd.read_csv(file, header=None)
    gdf = gpd.GeoDataFrame(
        df, crs=input_crs , geometry=gpd.points_from_xy(df.iloc[:,0], df.iloc[:,1]))

    gdf.to_crs(output_crs, inplace=True)
    gdf.iloc[:,0] = gdf.geometry.x # replace x
    gdf.iloc[:,1] = gdf.geometry.y # replace y
    
    # export reprojected csv 
    gdf.iloc[:,:-1].to_csv(os.path.join(out_path, file), index=False )
```

In the above code, we loop through our CSV files. For each file, we create a GeoDataFrame and change the CRS. Lastly, we replace the coordinates with reprojected one. 

### Endnote

There is another way I found by using **pyproj** library which is quite verbose but performs reprojection on-the-fly. To read about the **pyproj** method, refer [here](https://gis.stackexchange.com/a/168496).

