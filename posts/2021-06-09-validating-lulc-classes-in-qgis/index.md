---
title: Validating LULC classes in QGIS
date: 2021-06-09
slug: validating-lulc-classes-in-qgis
categories: [QGIS, machine learning]
tags: [qgis, machine learning]
description: 'The objective of this quality assessment was to validate the land cover map performed on June, 2020 sentinel-2 imagery by k-means classification algorithm in QGIS'
featured: no
---


## **The problem statement**

Any land-use land cover classification needs to be validated with ground-truth data to measure the accuracy. A key single-valued statistic to determine the effectiveness of classification is Cohen’s kappa. This validation metric has been fairly widely used for unbalanced classification as well which expresses a level of agreement between two annotators on a classification problem.

The objective of this quality assessment was to validate the land cover map performed on June, 2020 sentinel-2 imagery by k-means classification algorithm, thus providing a statistical measure of overall class predictions. The validation was done using an independent set of sample points (~500) generated randomly following stratified random sampling design, to capture the variance within the class

After running the tool, the sample points were manually assigned to the ground-truth class. The ground-truth dataset was taken to be Bing-satellite imagery as a proxy for field data. Each sample point was labelled by visual inspection on the ground-truth dataset. 

## **Step 1: Classify Image**

- Load raster Image
- Open `K-means clustering for grids` under SAGA tools. Select the raster Image as `grid` and in this case we specify 4 classes

<figure>

![](https://i.imgur.com/xdx5Tsn.png)

<figcaption align = "center"><b><i>Fig.1 -K-means clustering on sentinel-2 Image</i></b></figcaption>

</figure>



- Click `Run`

> At this stage we have unsupervised k-means clustering output ready `(Fig.2)`.

<figure>

![](https://i.imgur.com/eW0cOXE.png)

<figcaption align = "center"><b><i>Fig.2 -classification of RR Nagar, Bengaluru. Classes- Forest, Urban, water, Bareland</i></b></figcaption>

</figure>



---

## **Step 2: Convert to polygon (vector format)**

- Select `Polygonize (Raster to Vector)` tool under `GDAL`->`Raster Conversion`
- Select the classified image as input. Leave everything else as default. The output would be a `Vectorised` scratch layer.

<figure>

![](https://i.imgur.com/36nk2tF.png)

<figcaption align = "center"><b><i>Fig.3 -Convert Raster to vector</i></b></figcaption>

</figure>

> Note the name of the field (`DN` here). This will be used later.

- Fix geometries (this step is important here to avoid any error in further steps) `Vector Geometry`->`Fix Geometry`

<figure>

![](https://i.imgur.com/gG9gBIc.png)

<figcaption align = "center"><b><i>Fig.4 -Fixing topology issues with <code>Fix Geometry</code> Toolbox</i></b></figcaption>

</figure>



---

## **Step 3: Dissolve the layer on DN field**

In this step we dissolve the layer based on the `DN` value. This will ensure that each polygon can be evaluated based on the land class type which is needed for stratified random sampling.

<figure>

![](https://i.imgur.com/gm1ihfT.png)

<figcaption align = "center"><b><i>Fig.5 -<code>Dissolve</code> toolbox to dissolve polygon on <code> DN </code> value</i></b></figcaption>

</figure>

> Make sure to select dissolve field as `DN`

---

## **Step 4: Create stratified random samples**

Go to `Vector->research tools-> Random Points inside Polygon` and set `Sampling Strategy` = `Points Density` and `Point count or density` = `0.001`.

Note: The value `0.001` signify `1` point for `1/0.001` m2 of area, given that the units is meters. 

<figure>

![](https://i.imgur.com/1LB6R5L.png)

<figcaption align = "center"><b><i>Fig.6 - One sample point is generated for each 1000 m2 of area</i></b></figcaption>

</figure>

---

## **Step 5: Extract raster values to sample layer**

We extract the raster value, which is essentially the land cover class for the classified image. We use `Sample Raster Values` function here (`Fig.7`). The input layer is the random points we generated earlier and the the raster layer is the classified image. The output adds a new column to the sample points layer with the prediction class of the land-cover (`Fig.8`). 

<figure>

![](https://i.imgur.com/s2RXNOZ.png)

<figcaption align = "center"><b><i>Fig.7 -Running <code>Sample Raster Value</code> to extract Raster values for the input points</i></b></figcaption>

</figure>


<figure>

![](https://i.imgur.com/GG9wgNK.png)

<figcaption align = "center"><b><i>Fig.8 -The corresponding Attribute Table with Predicted Class <code> PREDICTED_1</code> for each feature</i></b></figcaption>

</figure>



---

## **Step 6: Ground Truth Labelling using Bing maps**

At this stage we are ready to validate the image using Bing maps as ground truth. We turn on the edit mode and create new field named Actual class. THen we visually inspect the class on the map and note the land-cover class. Once we inspect all the sample points we can use cohens Kappa statistics to determine the validation result. Alternatively, simply calculating the accuracy would also suffice the need.

## **Step 7: Add other field to the attribute table with reclassification**

We can use the `Field Calculator` to generate verbose text for each label in our feature class and display labels for the prediction.

```sql
-- in field calculator to increase verbosity
CASE WHEN PREDICTED_1 is 2 THEN 'Urban' 
WHEN PREDICTED_1 is 1 THEN 'Bareland'
WHEN PREDICTED_1 is 4 THEN 'Forest'
WHEN PREDICTED_1 is 3 THEN 'Urban'
END
```

<figure>

![](https://i.imgur.com/3CBAK6X.jpg)

<figcaption align = "center"><b><i>Fig.9 -Predicted classes (foreground) vs ground truth (background)</i></b></figcaption>

</figure>

With this we come to end of the post. Now, validation accuracy can be reported for k-means classification.
