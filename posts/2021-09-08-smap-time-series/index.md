---
title: SMAP Time Series
date: 2021-09-08
slug: smap-time-series
categories: [Remote Sensing]
tags: []
subtitle: ''
description: 'We perform time-series analysis of soil moisture derived from SMAP L3 product for Bengaluru city.'
authors: []
lastmod: '2021-09-08T18:43:06+05:30'
featured: no
url_code: "https://github.com/amanbagrecha/smap_time_series_analysis"
---


## Overview

Farmers in parts of India still rely on groundwater for irrigation. For them to help understand the present condition of their farm, NASA’s Soil Moisture Active Passive (**SMAP**) satellite data could fill a significant void.

The mission collects the kind of local data agricultural and water managers worldwide need.

The main output of this data set is **surface soil moisture** (SSM)(representing approximately the top 5 cm of the soil column on average, given in cm3 /cm3 ) presented on the global 36 km EASE-Grid 2.0. While there are other measurements, we are only restricting ourselves to SSM

The SSM product has three main levels. L1, L2, and the latest being L3. SMAP uses a radiometer to detect microwave signals and process to obtain soil moisture. It initially had radar onboard but failed in 2015. Although the product is primarily available in 36 km resolution, with the help of Sentinel-1 Radar product, we now have access to 9 km resolution daily global product as well post 2016.

We are going to work with a 36 km product since a time-series can be computationally intensive to download.

One such product is **L3_SM_P**, a daily global product, which is an abbreviation of L3 soil moisture 36 km resolution.

We choose Bengaluru as our area of interest and perform the following three steps in sequence

- Download the SMAP L3 data for the latest one month ( **August 2021** here).

- Extraction of the soil moisture values from SMAP L3 data over Lat, Lon of Bengaluru in python.

- Plot the time series plot for the extracted soil moisture values for the latest one month.

To download the SMAP L3 data, we head over to https://nsidc.org/data/SPL3SMP/versions/7 and select a time-period ( in our case for the entire month of August 2021) under the download tab. We then click on the download script button as a python file.

<figure>

 ![](https://i.imgur.com/aoKJnay.jpg)

<figcaption align = "center"><b><i>Fig.1 -Downloading python script for the month of August from NSIDC</i></b></figcaption>

</figure>

 
As can be seen in the picture, we have a download size of 980 mb once we run the python script.
The next step would be to download the actual files and extract soil moisture value for the selected lat long.
One thing to note is, since the product has a resolution of 36 km and that the entire pixel represents one value, we have to couple together a set of pixels around Bengaluru since the entire region does not overlay in one pixel size.

We would be using colaboratory in this entire process since it allows for smooth use of the command line within the notebook itself.

### Run the downloaded script. It will ask you for your earth data credentials (username and password)

We move the downloaded files to data directory and delete any associated files that comes along with it.

```python
# Download data: Enter credentials for earth data
%run /content/download_SPL3.py
 
# move files to data dir
!mkdir -p data/L3_SM_P
!mv *h5 data/L3_SM_P
!rm *.h5*
 
```
Next, get the lat long for EASE grid 2.0. Since we have to locate Bengaluru (study area) and SMAP uses a specific grid system, we download these files.
```python
!wget https://github.com/nsidc/smap_python_notebooks/raw/main/notebooks/EASE2_M36km.lats.964x406x1.double
!wget https://github.com/nsidc/smap_python_notebooks/raw/main/notebooks/EASE2_M36km.lons.964x406x1.double
```
 
### Extract soil moisture

We define a python class since there are two half-orbit passes (ascending and descending pass) and we could later combine them easily. 

We create a `read_SML3P` method which reads the hdf5 files using the h5py library as an array and removes noisy elements as defined by the user guide. The filename contains the date of acquisition and we extract that.

We next define the `generate_time_series` method to subset the array to our area of interest (Bengaluru) while also taking the mean since there might be more than 1 pixel intersecting the AOI and then return a dataframe with date and the value of Soil Moisture.

There are some additional method we define to run and initialise the class which can be read from [here](https://github.com/amanbagrecha/smap_time_series_analysis/blob/main/main.py)
 
```python
class SML3PSoilMoist:
  """
  get soil moisture from L3 SMAP SCA-V algo for the specified date
  Parameters
  ----------
  soil_moisture: numpy.array
  flag_id:  [str] Quality flag of retrieved soil moisture using SCA-V
  var_id: [str] can be replaced with scva algorithm which is the default (baseline)
  group_id: [str] retrive soil moisture for Ascending or descending pass
  file_list: [list] of downloaded files; File path of a SMAP L3 HDF5 file
  -------
  Returns Soil moisture values and time period as a DataFrame
  """
 
  def __init__(self, file_list : 'list', orbit_pass: 'str'):
    
    ...
 
  def run_(self):
    """read files and return 3d array and time"""
    ...
 
 
  def read_SML3P(self, filepath):
    ''' This function extracts soil moisture from SMAP L3 P HDF5 file.
    # refer to https://nsidc.org/support/faq/how-do-i-interpret-surface-and-quality-flag-information-level-2-and-3-passive-soil

    '''    
    with h5py.File(filepath, 'r') as f:
 
        group_id = self.group_id 
        flag_id = self.flag_id
        var_id = self.var_id
 
        flag = f[group_id][flag_id][:,:]
 
        soil_moisture = f[group_id][var_id][:,:]        
        soil_moisture[soil_moisture==-9999.0]=np.nan;
        soil_moisture[(flag>>0)&1==1]=np.nan # set to nan expect for 0 and even bits
 
        filename = os.path.basename(filepath)
        
        yyyymmdd= filename.split('_')[4]
        yyyy = int(yyyymmdd[0:4]); mm = int(yyyymmdd[4:6]); dd = int(yyyymmdd[6:8])
        date=dt.datetime(yyyy,mm,dd)
 
    return soil_moisture, date
 
  def generate_time_series(self, bbox: 'list -> [N_lat, S_lat, W_lon, E_lon]'):
    
    N_lat, S_lat, W_lon, E_lon = bbox
    subset = (lats<N_lat)&(lats>S_lat)&(lons>W_lon)&(lons<E_lon)
    sm_time = np.empty([self.time_period]);
    
    sm_data_3d, times = self.run_()
    for i in np.arange(0,self.time_period):
        sm_2d = sm_data_3d[:,:,i]
        
        sm_time[i] = np.nanmean(sm_2d[subset]);
 
    return pd.DataFrame({'time' : times, self.orbit_pass: sm_time })
```

Lastly, we plot the dataframe using pandas method `plot` and the result is to be shown to the world.

![](https://i.imgur.com/PngGsda.png)

This blog helps demonstrates use of SMAP product to generate time series for an entire month of August. You can read more about the specification of the product [here](https://nsidc.org/support/faq/how-do-i-interpret-surface-and-quality-flag-information-level-2-and-3-passive-soil)

> Data courtesy: O'Neill et al. doi: https://doi.org/10.5067/HH4SZ2PXSP6A. [31st August, 2021].

