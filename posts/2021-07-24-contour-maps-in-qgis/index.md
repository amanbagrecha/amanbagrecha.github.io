---
title: Contour Maps in QGIS
date: 2021-07-24
slug: contour-maps-in-qgis
categories: [QGIS]
tags: []
description: 'Generate contour maps in QGIS and understand various interpolation methods.'
featured: no
---

## Overview
Most of the time, we are equipped with a discrete set of sample points (of temperature, rainfall etc) and are tasked with generating a continuous surface.
This is where spatial interpolation comes into picture. The objective is to estimate the most probable value at an unknown location with a set of known points within the extent of sample points.


Methods to perform spatial interpolation:
1. TIN: Triangular Irregular Network forms contiguous, non-overlapping triangles by dividing the geographic space on set of sample points

2. IDW: Inverse Distance Weighted interpolation method estimates cell values by weighted average of sample data. The closer the point, the more weight assigned. We can fix the radius of influence or the total sample points to weigh for cell value.

3. Spline: Also called french curves. It uses a mathematical function that minimizes overall surface curvature, resulting in a smooth surface that passes through the input points.

4. Kriging: A group of geostatistical techniques to interpolate the value of a random field at an unobserved location from observations of its value at a nearby location. It is implemented using semi-variogram.

In this blog, we create surface plots for Rainfall Correction Factors, which is indicative of how much the climate impacts a hydraulic structure based on the return period it is designed for.

These RCF are useful for hydraulic structures such as dams, storm water drains, and spillways.
These RCF are derived from Global Climate Models (GCMs) which models future scenarios. Not considering these factors can lead to reduced life time of the structure.


We calculate the RCF for each point for a grid of lat,lon around the indian subcontinent. These RCF are as a result of intensive computational simulations run in matlab which is out of scope for this blog.
 
 
### 1. Load points in QGIS
 
Our data is in the csv format with each column of the RP_ family representing the return period the Rainfall Correction Factor is estimated for. 
 

<figure>

![](https://i.imgur.com/fZpYAK9.png)
<figcaption align = "center"><b><i>Fig.1 -sample data points with key location and return period of RCF</i></b></figcaption>

</figure>


 
This file can be imported into qgis from the layers panel and adding a delimited text layer. Once the layer is added, we export as shapefile so as to ease the process of automating the workflow which comes in handy later at the end of the blog.
 

<figure>

![](https://i.imgur.com/MvHcCZx.png)
<figcaption align = "center"><b><i>Fig.2 -Add the csv file using Add delimited text layer</i></b></figcaption>

</figure>


 
We load the sampled points and add an India boundary as the base vector to later clip the features to our area of Interest.

<figure>

![](https://i.imgur.com/IuoE9pb.png)
<figcaption align = "center"><b><i>Fig.3 -Points equally spaced around the Indian state. Each point represent a RCF value</i></b></figcaption>

</figure>

 
 
### 2. Generate Raster from points using TIN interpolation

For demonstration let us take an example to run through the entire process of generating surface raster and styling which can be later automated using python in qgis.

We use these sampled locations of points to generate a surface using TIN Interpolation readily available as a toolbox in qgis. The input parameter for the vector layer is our shapefile of points while the interpolation attribute is going to be the RP_ family of columns. 
 

<figure>

![](https://i.imgur.com/nzE5Vj7.png)
<figcaption align = "center"><b><i>Fig.4 -TIN interpolation in QGIS</i></b></figcaption>

</figure>

 
The output of the interpolation with pixel size of 0.01 is shown below. The extent was set to the boundary of Indian state. 

<figure>

![](https://i.imgur.com/1HAjqQ4.png)
<figcaption align = "center"><b><i>Fig.5 -Output surface raster with 0.01 pixel size</i></b></figcaption>

</figure>


 
We can go a step further and derive contours using the `contour` toolbox provided in qgis.
 
 
 
 
### 3. Generate Contours from raster to style the layer

<figure>

![](https://i.imgur.com/SOKxUmC.png)
<figcaption align = "center"><b><i>Fig.6 -Generate contours from the surface raster</i></b></figcaption>

</figure>

 

<figure>

![](https://i.imgur.com/ExfM0MM.png)
<figcaption align = "center"><b><i>Fig.7 -Output as contour lines with 0.1 as interval</i></b></figcaption>

</figure>

 
A better way to get the contour lines is by changing the symbology of the raster to contours and providing an interval. This exact method will be employed later in this post.
 
### Automating the process
 
So far we have looked into creating surface raster for an individual return period. But we have several other return periods and we do not want to repeat ourselves. Thus we write a tiny python code to automate this workflow.
 
We derive the RCFs for return period of 5year, 10year, 25year, 50year


```python
# specify the output location for saving the files
OUTPATH = 'D:\\gcm_qgis\\'

# loop over different return periods from the shapefile
for i,j in enumerate(['2y', '10y', '25y', '50y'], 3):

    # specify the shapefile containing the RCP values
    MYFILE = 'D:\\gcm_qgis\\RCP_avg.shp|layername=RCP_avg::~::0::~::{}::~::0'.format(i)

    # Run interpolation and do not save the output permanently
    RESULTS = processing.run("qgis:tininterpolation", 
    {'INTERPOLATION_DATA': MYFILE,
    'METHOD':1,
    'EXTENT':'68.205600900,97.395561000,6.755997100,37.084107000 [EPSG:4326]',
    'PIXEL_SIZE':0.01,
    'OUTPUT':'TEMPORARY_OUTPUT'})

    # clip the temporary output from prev step and save the files.
    processing.runAndLoadResults("gdal:cliprasterbymasklayer", 
    {'INPUT':RESULTS['OUTPUT'],
    'MASK':'C:/Users/91911/Downloads/india-osm.geojson.txt|layername=india-osm.geojson',
    'SOURCE_CRS':None,'TARGET_CRS':None,'NODATA':None,
    'ALPHA_BAND':False,
    'CROP_TO_CUTLINE':True,
    'KEEP_RESOLUTION':False,'SET_RESOLUTION':False,'X_RESOLUTION':None,
    'Y_RESOLUTION':None,
    'MULTITHREADING':False,'OPTIONS':'',
    'DATA_TYPE':0,
    'EXTRA':'',
    'OUTPUT':os.path.join(OUTPATH, 'RCP_avg_' + j + '.tif')})
    iface.messageBar().pushMessage(
        'Success:', 'Output file written at ', level=Qgis.Success)
```


Our output would save and display the contour files with RCP_avg_{return_period} where return period ranges from [2,5,10,25,50]


The code first fetches our shapefile, which is used to 
  1. create temporary TIN interpolation rasters
  3. clipped to india boundary using `clip raster by mask layer`


Once we have the rasters for each return period, we style the raster using singleband pseudocolor in `Equal Interval` mode ranging from 1.0 - 1.8 in steps of 0.1

We make a copy of the raster layer and place it above it, giving it a contour style at an interval of 0.1 

We copy each return period and set the styling to be of contour as seen in the figure. This allows for a better visual representation of the regions with same the values. 

<figure>

![](https://i.imgur.com/tz0DP0k.png)
<figcaption align = "center"><b><i>Fig.8 -Styling the copy of surface raster</i></b></figcaption>

</figure>


The final output can be seen in the below figure.

<figure>

![](https://i.imgur.com/fiX9RA9.png)
<figcaption align = "center"><b><i>Fig.9 -Final output with contours overlaid on top of surface themself</i></b></figcaption>

</figure>


## Final comments

We looked at various spatial interpolation technique and automated workflow to derive spatially interpolated surface raster.





Sources:

a. [Comparison of Spatial Interpolation Techniques Using Visualization and Quantitative Assessment](https://www.intechopen.com/chapters/52704) 

b. [Spatial Analysis QGIS](https://docs.qgis.org/3.16/en/docs/gentle_gis_introduction/spatial_analysis_interpolation.html)
