---
title: Import CSV and OSM data into PostgreSQL using ogr2ogr
date: 2022-09-18
slug: import-csv-and-osm-data-into-postgresql-using-ogr2ogr
categories: []
tags: []
subtitle: ''
lastmod: '2022-09-18T15:14:02+05:30'
featured: no
image: featured.png
---


[ogr2ogr](https://gdal.org/programs/ogr2ogr.html) is the swiss knife for vector geometry conversion. You can import CSV with latitude and longitude columns as Point geometry into PostgreSQL. This tool also makes it easy to import OSM data to be imported into PostgreSQL with a lot of flexibility. 



## 1. Insert CSV to PostgreSQL

Our CSV contains information about retail food stores including cafes, restaurants, grocery information with the location and name. Download the data [here](https://github.com/amanbagrecha/amanbagrecha.github.io/files/9592312/filter_all_cat_data.csv)

![image](https://user-images.githubusercontent.com/76432265/190896961-cc985bf1-0b5b-4665-b53a-bcb9eadf50eb.png)


We first read the metadata of the CSV using ogrinfo

```sh
ogrinfo -so filter_all_cat_data.csv filter_all_cat_data
```

Assuming you have a database already (`postgres` here), we run the following command to create `postgis` extension for `postgres` database. The connection string is of the format as described [here](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)

```sh
psql -c "create extension postgis;" "postgresql://postgres:1234@localhost:5432/postgres"
```

Finally, we insert the CSV into PostgreSQL table named **cat_data_copy** and assign CRS of EPSG:4326.

```sh
ogr2ogr -f PostgreSQL PG:"host=localhost user=postgres dbname=postgres password=1234" filter_all_cat_data.csv -oo X_POSSIBLE_NAMES=long_url -oo Y_POSSIBLE_NAMES=lat_url -nlt POINT -nln "cat_data_copy" -sql "select name,city,lat_url,long_url,type from filter_all_cat_data" -a_srs "EPSG:4326”
```
The following explains few of the flags

- `-oo`: `X_POSSIBLE_NAMES` and `Y_POSSIBLE_NAMES` allows us to specify geometry columns from CSV

- `-nlt`: Define the geometry type for the table

- `-nln`: alternate Table name (defaults to name of the file)

- `-sql`: write SQL to insert only selected columns into the table

---


## 2. Insert OSM data to PostgreSQL

Our OSM data is of Bahamas downloaded from geofabrik. You can download it from [here](https://download.geofabrik.de/central-america/bahamas-latest.osm.pbf)

We first read the metadata of the OSM data using ogrinfo

```sh
ogrinfo -so bahamas-latest.osm.pbf multipolygons
```

We find about the geometry column, CRS and columns in the data. This will be used when inserting the data into the database.


Next we create postgis and hstore extensions in our `postgres` database. 

```sh
psql -c "create extension hstore; create extension postgis" "postgresql://postgres:1234@localhost:5432/postgres"
```

Finally we insert the data into PostgreSQL with table name as **bahamas_mpoly** with only multipolygons. We convert the `other_tags` column into `hstore` and insert only those rows where the `name` column does not contain a null value. We also clip our data to a bounding box and promote our polygons to multipolygons to avoid error.

```sh
ogr2ogr -f PostgreSQL PG:"dbname=postgres host=localhost port=5432 user=postgres password=1234" bahamas-latest.osm.pbf multipolygons -nln bahamas_mpoly -lco COLUMN_TYPES=other_tags=hstore -overwrite -skipfailures -where "name is not null" -clipsrc -78 23 -73 27 -nlt PROMOTE_TO_MULTI
```

---

#### Video version of the blog can be found [here](https://youtu.be/87liLpASYPI)