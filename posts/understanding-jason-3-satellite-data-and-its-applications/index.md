---
title: 'Understanding Jason-3 satellite: Data and its Applications'
date: 2023-01-26
slug: understanding-jason-3-satellite-data-and-its-applications
categories:
- Python
- Remote Sensing
description: 'Understand Jason-3 level-2 satellite products and know how to download it'
featured: no
image: featured.png
draft: false
---

### What is Jason-3?
Jason-3 is a satellite which measures topographic height of the entire earth once every ~10 days since the year 2016 and is used in applications such as sea level rise, ocean circulation, and climate change.
- It has an **altimeter** which measures the two-way travel time from the Earth's surface to satellite.
- It emits a pulse (radar pulse in this case) at a certain frequency to measure time. Thus it can also penetrate clouds.



<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.15.0/dist/maplibre-gl.css" />
<script src="https://unpkg.com/maplibre-gl@5.15.0/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/pmtiles@3.2.0/dist/pmtiles.js"></script>

<div id="map" style="height: 450px; width: 100%; margin-bottom: 10px;"></div>

<figcaption align="center"><b><i>Fig.1 - Sentinel-3 ground track visualised on interactive map. Each line represents a satellite pass measurement.</i></b></figcaption>

<script>
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const PMTILES_URL = "s3a-sral-tracks.pmtiles";
  const p = new pmtiles.PMTiles(PMTILES_URL);
  protocol.add(p);

  p.getHeader().then(h => {
    const map = new maplibregl.Map({
      container: "map",
      center: [h.centerLon, h.centerLat],
      zoom: Math.max(0, h.maxZoom - 2),
      style: 'https://cdn.jsdelivr.net/gh/osm-in/mapbox-gl-styles@master/osm-mapnik-india-v8.json'
    });

    map.on('load', () => {
      // Add the PMTiles source
      map.addSource('tracks', {
        type: 'vector',
        url: `pmtiles://${PMTILES_URL}`
      });

      // Add the satellite tracks layer
      map.addLayer({
        id: 'tracks_line',
        type: 'line',
        source: 'tracks',
        'source-layer': 'S3A',
        paint: {
          'line-color': '#0066cc',
          'line-width': 2,
          'line-opacity': 0.7
        }
      });
    });

    map.addControl(new maplibregl.NavigationControl());
  });
</script>



### Understanding Jason-3 Family of products

Jason-3 is processed to level-2 from telemetry data (level-0) and is available online for users to download via NOAA, EUMETSAT and CNES. **Jason-3 level-2 product** has 3 family of products depending on their **latency**. The near real time data with latency of 3-5 hours is categorised under Operational Geophysical Data Record (**OGDR**) product family, with latency of 1-2 days under Interim geophysical data record (**IGDR**) product family, and with latency of 60 days under geophysical data record (**GDR**) product family.

> Note: Higher the latency, more accurate the measurements since GDR products, unlike OGDR and IGDR products, are fully validated and calibrated.

Under each family, they are categorised with **reduced**, **native** and **sensor** product. The difference between them is in the amount and type of data included, as described in the figure below.


![Describing Jason-3 Product Family and its childs. Reduced product only contains data with 1Hz frequency. Native product contains data with 1Hz + 20Hz. Sensor contains 1Hz + 20Hz + waveforms. GDR product is fully validated and has highest accuracy.](https://user-images.githubusercontent.com/76432265/216826096-35712afa-a141-4bb5-8dcd-1f2f8eed1365.png)


### Which Jason-3 data product should I use?
The answer depends on 3 key factors: 1. Latency, spatial resolution, spectral resolution.

I've already mentioned the latency difference between three parent products (see above section). Depending on user requirements and accuracy, one of the three families can be selected.

Let us now look at two other factors which will help you decide which data product to choose.

Spatial resolution here is the distance between two measurements, while spectral resolution is the richness of data. **sensor product** contains information about the photon signals (waveforms) and might not be useful for certain applications, while **reduced product** has sparsely spaced measurements, i.e, number of total measurements are less and it does not contain waveform information.

To illustrate which product to choose among the 8 products from 3 family, let us look at few real world use cases to help with our selection  -


- If I aim to create a DEM for a large scale area which has relatively relatively terrain surface and do not require near real time data, I'd prefer using **reduced product** from *GDR family*. While if the surface is undulating, I'd prefer **native product**, which has measurements at better spatial resolution.

- If I am working on a climate variable, say, looking at atmospheric correction which requires raw photon signals as well, I'd use **sensor product** from *IGDR family* or *GDR family* depending on requirement.

- If I am working on mission critical problem, and require near real time data with good spatial resolution, but do not need waveform data, I'd use **native product** from *OGDR family*.

---

> Earthdata hosts a product called **GPS OGDR SSHA** which is delivered near real time (8-10 hours) as **reduced product** (1Hz only). This product is more accurate than **OGDR SSHA** from the OGDR family described above due to it being processed against GPS orbit rather than DORIS orbit ( which is used for all other products described in figure 2). Though **GPS OGDR SSHA** product is only available from 2020 october onwards.

Now that we know which product to download, let us look how and where to download them.


**Manual Download**

- [Earthdata Search JASON3 GPS OGDR](https://search.earthdata.nasa.gov/search/granules?p=C2205122298-POCLOUD): It only allows you to visualise the ground track of the product you are going to download.
- [NCEI NOAA JASON3](https://www.ncei.noaa.gov/data/oceans/jason3/): It has a GUI to check out the available products for each family, cycle and pass. Each family is suffixed with the version number.
- [CMR API virtual Directory JASON3 GPS OGDR](https://cmr.earthdata.nasa.gov/virtual-directory/collections/C2205122298-POCLOUD): It is same as NCEI NOAA, but only 1 product is available through CMR API virtual directory



**Programmatic download Links**

- [PODAAC S3 access](https://archive.podaac.earthdata.nasa.gov/s3credentialsREADME): Direct S3 access to only *GPS OGDR SSHA* **reduced product**. To know about bucket information, see [here](https://podaac.jpl.nasa.gov/dataset/JASON_3_L2_OST_OGDR_GPS)
- [CMR API JASON3 GPS OGDR](https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2205122298-POCLOUD): CMI API access to only *GPS OGDR SSHA* **reduced product**. More details on how to use this API is described below.
- [FTP NCEI NOAA JASON3](ftp://ftp-oceans.ncei.noaa.gov): This FTP server hosts all the data described in figure 2. More information on how to download it is given below.


> Data hosted by NCEI NOAA has all the data available for download, but NASA earthdata only hosts *GPS OGDR SSHA* **reduced product**.



### Download from CMR API

The code for downloading jason-3 data using CMR API can be found [here](https://github.com/amanbagrecha/jason3/blob/main/jason3_script.py).
Broadly, The code sends a request to CMR Search API https://cmr.earthdata.nasa.gov/search/granules.json along with parameters to filter by date, region and number of products required. The result is passed to authenticate with earthdata credentials and the file is downloaded to the local machine.



### Download from FTP server

The entire code for downloading jason-3 data using FTP Server can be found [here](https://github.com/amanbagrecha/jason3/blob/main/jason3_ftp_script.py).
In this code, the FTP directory is fetched for a specific product. To know which parent family folder to choose, we need to understand family versions for the Jason-3 product.


![Jason-3 products grouped according to model version as seen in NOAA server directory at ncei.noaa.gov/data/oceans/jason3/.](https://user-images.githubusercontent.com/76432265/216826675-886e72bd-bb71-4727-ac76-86d7accd830d.png)


The Jason-3 family product is versioned based on whether the product is in calibration/validation phase or intended to be used by the end user. If **`T`** is suffixed with the name of the parent folder, it means cal/val phase otherwise it is for end user.
Product families with no suffix, combines all the versioned family product, keeping the latest for each cycle. It has data for all cycles till the latest available date.


> Since September 2018, all data products associated with **`gdr`** family have been moved to version **`f`**. If you require historcal jason3 data, it is a no-brainer to use GDR family products since it is at the most accurate among all the families and also has been updated with the latest model version **`f`**.

<figure>
<iframe width="100%" height="450" src="https://www.youtube.com/embed/WUfq2zLW4zo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</figure>


References

- [Jason-3 Product Handbook](https://www.ospo.noaa.gov/Products/documents/hdbk_j3.pdf)
- [PODAAC JPL NASA](https://podaac.jpl.nasa.gov/dataset/JASON_3_L2_OST_OGDR_GPS)
- [Sentinel-3 SRAL Tracks](https://dataspace.copernicus.eu/explore-data/data-collections/sentinel-data/sentinel-3)

