---
title: 'COGs as the Stand-in Replacement for GeoTIFFs'
date: 2022-03-06
slug: cogs-as-standin-replacement
categories: []
tags: []
subtitle: ''
description: ''
lastmod: '2022-03-06T21:13:15+05:30'
featured: no
image: featured1.png
---

I decided to write this blog when my twitter feed was buzzing with the usefulness of Cloud Optimized GeoTIFF (COGs) and how it is a paradigm shift in the way we serve raster on any client application. I also look at potential gotchas when creating COGs and when it might end up **not** being useful.

So, this post will mostly focus on COGs and why I would use them over plain GeoTIFFs. Also, we would look at associated jargons when you want to create a COG. I aim to dump my thoughts once and for all and hopefully help others on the way.

### Table of Content

|       |  |
| ----------- | ----------- |
| **What is a block ?** | Understand what is a Block in raster |
| **What is an overview?** |  What are Overviews and how are they useful to us |
|**Overview levels** | How does Block and Overview affect me  |
| **Experiments** | Playing around with JP2000 format |
| **COGs** | COGs as Stand-in replacement |


While looking at "How to generate a COG", I encountered some fancy jargons — Block, Tile, Overview and Pyramid. Understanding them is essential to get the most out of COGs. Although I had known about them from when I started my GIS career, but you truly understand anything only when you apply it, don't you? 

To comprehend the above terms, let us take an example and experiment with it. I have a sentinel-2 L2A band 03 downloaded from [scihub](https://scihub.copernicus.eu/dhus/). The data is in JPEG2000 format (which is not a cloud optimized format).

On performing `gdalinfo ./T43PHP_20210123T051121_B03_20m.jp2`, the output gives a detailed description of the dataset. We focus on last few lines, 


```bash
Band 1 Block=640x640 Type=UInt16, ColorInterp=Gray
Overviews: 2745x2745, 1373x1373, 687x687, 344x344
Overviews: arbitrary
Image Structure Metadata:
  COMPRESSION=JPEG2000
  NBITS=15
```

The `block` parameter represents the shape of tile (width x height) in the raster image. For example a `Block=640x640` represents a tile of width of 640 and height of 640 pixels. **Fig. 1** illustrates a tile as displayed on a web application.


<figure>

![](https://upload.wikimedia.org/wikipedia/commons/0/03/Tiled_web_map_Stevage.png)

<figcaption align = "center"><b><i>Fig.1 -
Example of Web Map Tiles. The squares represent a <b>block</b>.</ href> </i></b></figcaption>

</figure>

### What is a `block` ?

> A block corresponds to a rectangular subpart of the raster. The first value is the width of the block and the second value its height. Typical block shapes are lines or group of lines (in which case the block width is the raster width) or tiles (typically squares), such as here. Knowing the block size is important when efficient reading of a raster is needed. In the case of tiles, this means reading rasters from the left-most tile of the raster to the right-most of the upper lines and progressing that way downward to the bottom of the image. *[Source](https://download.osgeo.org/gdal/workshop/foss4ge2015/workshop_gdal.pdf)*

So one thing is clear, Block and Tile are synonyms. 

Also notice the output contains `Overviews: 2745x2745, 1372x1372, 686x686, 343x343`. What are these numbers? Let's find out!

---

### What is an overview?

Overviews are reduced/downsampled versions of the raster. Overviews can also be termed interchangeably with **pyramids** in GIS. When you want to pan, zoom around the raster, it helps to have overviews. The concept is to reduce the dimension of the raster to facilitate faster rendering of Raster on our application. Each overview is a half the size of its previous dimension. They can be built both externally and internally. Having an external overview would generate an `.ovr` file which contains the information about the downsampled raster. While internal overviews alter the existing file permanently.

The above numbers for overviews (`2745x...`) tells us that the sentinel-2 image we are using here has internal overviews and tiling baked in it. Interestingly enough I found that it is not possible to build external overviews for `.jp2` (JPEG2000) format.

![](https://i.imgur.com/reoTn79.png)

### Overview levels

The numbers we see for overviews are also termed as levels. Overviews can be built at many levels (typically from level 1-18). When you have a large raster image (drone shots etc), these levels facilitate faster rendering.

<figure>

![](https://2rct3i2488gxf9jvb1lqhek9-wpengine.netdna-ssl.com/wp-content/uploads/2018/07/TilePyramid.jpg)

<figcaption align = "center"><b><i>Fig.2 -
Higher the pyramid level you move (zoom in), more detailed information from the raster you get, requiring more tiles to be generated. Image courtesy: <href src = "https://www.azavea.com/blog/2018/08/06/generating-pyramided-tiles-from-a-geotiff-using-geotrellis/tilepyramid/" >Azavea </ href> </i></b></figcaption>
</figure>

In **Fig.2** above, it should be clear that `tiling` is splitting up the raster into multiple blocks, while `overview` is reducing the resolution (downsampling) of the raster. Both overview levels and tile size has to be tuned to improve the performance for serving/rendering raster on our application.

Using a large tile size might reduce the overall number of GET requests but it will also mean more data transfer per request. Moreover, having many pyramid levels (overviews) can reduce the response time but the data overhead to create these overviews can turn out to be quite expensive (about 33% for each additional level).

### COGs as Stand-in replacement

With the aim to create COGs, I ended up experimenting with GeoTIFF and JP2000 formats. 

On converting our `.jp2` to `.tif` by running ```gdal_translate -of GTiff ./T43PHP_20210123T051121_B03_20m.jp2 b03.tif``` and then `gdalinfo ./b03.tif`, it resulted in file size = 58 MB, and

```bash
Band 1 Block=5490x1 Type=UInt16, ColorInterp=Gray
```

You'd notice that the file size of the `.tif` is much higher than that of `.jp2`. Additionally we do not see any overviews for the `.tif` file.

---

On running the command ```gdaladdo -r average ./b03.tif``` to add internal overview to my raster, and then `gdalinfo b03.tif`,  the output file size of the resulted raster is 78 MB, and

```bash
Band 1 Block=5490x1 Type=UInt16, ColorInterp=Gray
  Overviews: 2745x2745, 1373x1373, 687x687, 344x344, 172x172
```
The point I am trying to convey here is that when you add an overview to the raster, there is an additional cost in terms of storage. In my opinion, the reason sentinel-2 images are stored with `.jp2` format is because of lower file size since they do not have to serve the raster on the web but instead let users download them in entirety. This would save them a huge cost on storing the data.

### Cloud Optimized GeoTIFF (COG)
> With the COG, you'll be able to load the image faster and zoom in and out much smoother than you would if you were working with a regular GeoTIFF. With the GeoTIFF, the entire image needs to finish downloading before the tiles can be generated for viewing.

Cloud Optimized GeoTIFFs (COGs) are great! I use them in my work and they allow for easy and rendering of rasters on-the-fly. What makes it great is that it supports HTTP Range requests. This allows you to only fetch data where you are requesting it.

To create COGs using GDAL, it is as simple as typing

```bash
gdalwarp -of COG ./b03.tif b03_cog.tif
```
The result from the above command results in a file size of 87 MB and, 

```bash
Band 1 Block=512x512 Type=UInt16, ColorInterp=Gray
  Overviews: 2745x2745, 1373x1373, 687x687, 344x344, 172x172
```
By default, internal overviews and tiles are created for us. We can tune both Block size and Overview parameters if needed. See [here](https://gdal.org/drivers/raster/cog.html)

---

You can see from previous experiments that creating COGs can be a costly in terms of its size, but you should not leave it there. The true potential of COG is realized only when you pass in additional options (compression, tile size, overviews etc). 


```bash
gdalwarp -of COG -co COMPRESS=DEFLATE ./b03_cog.tif b03_cog_deflate.tif
```
The result from the above command results in a file size of 57 MB and, 

```bash
Band 1 Block=512x512 Type=UInt16, ColorInterp=Gray
  Overviews: 2745x2745, 1373x1373, 687x687, 344x344, 172x172
```

---

description
---
| Filename                              | Size  |       Remarks      |
|---------------------------------------|-------|:------------------:|
| T43PHP_20210123T051121_B03_20m.jp2    | 33 Mb |  Original size     |
| b03.tif                               | 58 Mb | convert jp2 to tif |
| b03.tif                               | 78 Mb | add overviews      |
| b03_cog.tif                           | 87 Mb | convert to COG     |
| b03_cog_deflate.tif                   | 57 Mb | COG with deflate   |


By this comparison you can see that, if you do not compress the file, it would ingress a huge cost to store them.

If your aim is to serve rasters on the browser or let users download the data, start using COGs with **additional options** and you won't notice any difference but only save money in the long run.

