---
title: Download MODIS data using CMR API in Python
date: 2022-07-28
slug: download-modis-data-using-cmr-api-in-python
categories: [Python]
tags: []
subtitle: ''
lastmod: '2022-07-28T21:15:16+05:30'
featured: no
image: featured.png
---

If you have ever used USGS Earth Explorer to download / explore data, you’d notice that the manual process is cumbersome and not scalable. That is why we require a programmatic way to download satellite data.

In this blog we’d see how to download MODIS data using Python. We use a Python package called [modis-tools](https://github.com/fraymio/modis-tools) to perform our task. This package internally uses [NASA CMR](https://cmr.earthdata.nasa.gov/search/) (Common Metadata Repository) API which lets us search and query catalogs of various satellite dataset including MODIS.

We focus on the MODIS dataset in this blog, but with little modification, we could extend for various other datasets.

Before you move ahead, make sure you have an earthdata account. We would require the username and password to download the data. Register [here](https://urs.earthdata.nasa.gov/users/new) if not done so.

---

To download the data we ask ourselves the following questions:

1. Which dataset specifically do I need? — Define _Dataset Name_
2. What area do I need the data for? — Define our _Region of Interest_
3. What time period of data do I require? — Define _Start and End Date_

Here, I wish to download MODIS Surface Reflectance 8-Day L3 Global 250 m SIN Grid data for Nigeria from 29 December, 2019 to 31st December, 2019.

Let us install and use the Python package `modis-tools` to download the data on our local machine by performing the following steps

1. Create a virtual environment.
2. Install the `modis-tools` package.
3. Write the code.


### To create a new environment

Create virtual environment `.modis-tools` using Python’s `venv`

```
aman@AMAN-JAIN:~$ python3 -m venv .modis-tools
```

Activate the environment.

```
aman@AMAN-JAIN:~$ source .modis-tools/bin/activate
```

**Note**: The above command is for linux. For Windows use .`modis-tools\Scripts\activate` instead.

### Install the modis-tools package

```
(.modis-tools) aman@AMAN-JAIN:~$ pip install modis-tools
```

### Insert the below code

Paste the code in a python file named `download.py`.

```python
# download_modis.py

# 1) connect to earthdata
session = ModisSession(username=username, password=password)

# 2) Query the MODIS catalog for collections
collection_client = CollectionApi(session=session)
collections = collection_client.query(short_name="MOD09GQ", version="061")
# Query the selected collection for granules
granule_client = GranuleApi.from_collection(collections[0], session=session)

# 3) Filter the selected granules via spatial and temporal parameters
nigeria_bbox = [2.1448863675, 3.002583177, 4.289420717, 4.275061098] # format [x_min, y_min, x_max, y_max]
nigeria_granules = granule_client.query(start_date="2019-12-29", end_date="2019-12-31", bounding_box=nigeria_bbox)

# 4) Download the granules
GranuleHandler.download_from_granules(nigeria_granules, session, threads=-1)
```

In the above code, change the `username`, `password`, `nigeria_box` and `start_date` & `end_date` according to your requirements.

To explain the above code —

- First we create a session, which makes a connection to earthdata and registers a session.
Next three lines we search for MODIS Surface Reflectance 8-Day L3 Global 250 m SIN Grid dataset using `short_name` and `version`.

- Now we filter the region spatially and temporally we want our data to be downloaded. In this example, we filter for the nigeria region with a bounding box (`bounding_box`) and the two days of december of 2019 (`start_date`, `end_date`).

- Lastly, we download the data (granules) using multithreading, since we asked to use all threads. (`threads=-1` is all threads).

### How to get `short_name` and `version` for the dataset?


The [collection endpoint](https://cmr.earthdata.nasa.gov/search/site/collections/) of the CMR API contains a directory of all dataset catalogs hosted by various organizations with its short name and version number. For MODIS data, LPDAAC_ECS hosts and maintains it. Under the `/collections/directory` endpoint, look for `LPDAAC_ECS` and search for the MODIS dataset you want to download. Each dataset has a short name and version associated with it as shown in the picture below. In our case we found `MOD09Q1` short name with version `061`.

![](https://i.imgur.com/x9aT290.png)

---

Now it is time to run the code to see our data being downloaded.

In your terminal, run —

```
(.modis-tools) aman@AMAN-JAIN:~$ python download_modis.py
Downloading: 100%|██████████████████████████████████████████████████████| 3/3 [00:10<00:00,  3.67s/file]
```
A progress bar would let you see the download progress and the files would be downloaded to your local disk. If you wish to download the data to a specific directory, use the path parameter in download_from_granules classmethod.

Endnote
This short post on downloading MODIS data originated when I wanted to set up and deploy a pipeline. I did find other packages but they were quite old and did not use the state of the art specifications. Since the solution presented here uses CMR API, which has a very good documentation, I preferred it over other tools.

You can find the video version of this blog [here](https://youtu.be/3K1yl79Mhow)


---

### For the curious (Advanced)

The base url for the CMR API is —

```sh
https://cmr.earthdata.nasa.gov/search
```

Internally, CMR API first finds the collection for our dataset —

```sh
https://cmr.earthdata.nasa.gov/search/collections.json?short_name=MOD09GQ&version=061
```

After that the package queries the granules endpoint to find individual granules matching our query parameters —

```sh
https://cmr.earthdata.nasa.gov/search/granules.json?downloadable=true&scroll=true&page_size=2000&sort_key=-start_date&concept_id=C1621091662-LPDAAC_ECS&temporal=2019-12-01T00%3A00%3A00Z%2C2019-12-31T00%3A00%3A00Z&bounding_box=2.1448863675%2C3.002583177%2C4.289420717%2C4.275061098
```

Note that most parameters are autogenerated by the python package depending on the `short_name` and `version` you provide (downloadable, scroll, page_size, sort_key, concept_id). The other parameters are user defined (temporal, bounding_box)

There are many more additional parameters which can be passed. A complete list is present in the [documentation](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html). One such useful parameter that you can try out is `cloud_cover`. All you need to do is pass this parameter name with value to the `query` method in the above code.

