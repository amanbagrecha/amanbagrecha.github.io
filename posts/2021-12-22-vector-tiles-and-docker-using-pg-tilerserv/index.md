---
title: Vector tiles and Docker using pg_tilerserv
date: 2021-12-22
slug: vector-tiles-and-docker-using-pg-tilerserv
categories: [Docker, Vector-tiles]
tags: [Docker, Vector-tiles]
subtitle: ''
description: 'Serve your geospatial data as Vector Tiles using pg_tileserv in a Docker container'
authors: []
lastmod: '2021-12-22T00:19:15+05:30'
featured: no
image: featured.png
projects: []
---


In this blog we look at how to serve your geospatial data as vector tiles using pg_tileserv in a docker container. 

## What are vector tiles?
Vector Tiles are similar to raster tiles, but instead of serving images, vector tiles serve geospatial data which are vectors themselves and not images. This allows for reduced data transfer over a network, faster loading while allowing client side rendering. Moreover, vector tiles allow for flexible styling of your geospatial data since it renders on the client side. All this is not possible with raster tiles and hence vector tiles have gained traction in the last few years.

One of the most popular specifications to serve vector tiles is mapbox vector tiles, utilized by many open source tile servers.

Because PostGIS can create mapbox vector tiles from vector data, it becomes easy to serve them over the web. Many tileservers use the power of this postGIS functionality to serve vector tiles over the web. 

As for a visual understanding as to what is different between vector and raster tiles, the following image illustrates that. The red bounding box is the response to clients request to serve vector tiles. Notice the format is `pbf` as opposed to `png` for raster tiles.

![](https://i.imgur.com/S5uzLpN.png)


## Why use docker for this?
Using docker would expedite the process of starting and "actually" using the applications. It is like sharing your machine with others so that they do not have to install anything to get started. For this reason, it makes complete sense to use docker for moderate to high complexity projects.

## What is pg_tileserve?
To create vector tiles, and serve them on the web, you need a middleware that can talk to the database and also serve them on the web. Since pg_tileserve uses a postgis function under the hood, it becomes a default choice to add a lightweight service to serve vector tiles. pg_tileserv returns Mapbox Vector tiles on input of vector geometry. In addition to reading tables from the database, it can handle complex functions to meet our needs.

ST_asMVT, an aggregate function which is used under the hood for pg_tileserv, returns mapbox vector tile format based on google protobuf. While there are other formats such as MBtiles which is sqlite based binary file (can be opened in sqlite), Mapbox Vector Tile format seems to be winning this race and is thus the most popular format currently.


### To get started with serving your vector data to the web using pg_tileserv, we follow the below mentioned steps

1. Download [pg_tileserv](https://github.com/CrunchyData/pg_tileserv) folder from [down-git](https://downgit.github.io/#/home) website and save it to your local directory. 
![](https://i.imgur.com/QkF6OF9.png)

The folder contains all the files required to start a docker container and serve vector tiles.
```
└───data/  — would contain all your vector data
└───load-data.sh — shell script to load data into PostgreSQL
└───pg_tileserv.env — database URL to connect
└───docker-compose.yml — 
└───pg.env — environment variable for database
└───cleanup.sh — assemble multiple containers
└───README — guide to setup docker by Just van den Broecke
```

2. Next, Modify `docker-compose.yml` file under **build->context** to point to the docker file https://github.com/CrunchyData/pg_tileserv.git. Since we did not clone the repository, we specify the Dockerfile using the git link. 

![](https://i.imgur.com/AzclY3c.png)

3. Dump all your geospatial data into `data` dir. This directory will be *mounted* to the container, once we start it.

5. Change the `pg_tileserv.env` environment file as you wish, to specify the name and password of your database.

Notes on env files: 
- `pg_tilerserv.env` file contains the database url which is of the format `postgres://your-username:your-password@localhost:5432/your-database-name` while `pg.env` contains credentials for postgres database.

Notes on docker-compose file
- We are mounting `data` dir from our local system to the work dir in the docker container.
- We are mapping port 7800 from our local machine to 7800 to the pg_tileserv container.


Start Docker Desktop and run `docker-compose build` in the command line. It will download the image needed from the dockerfile specified. It only downloads the latest alpine image and all other dependencies are installed in the build.

Once the database setup is done, we now load data into the database by running either `load-data.sh` shell script (or) the following command,

```sh
#Load data using shp2pgsql 
docker-compose exec pg_tileserv_db sh -c "shp2pgsql -D -s 4326 /work/ne_50m_admin_0_countries.shp | psql -U tileserv -d tileserv"
```
The above command opens a terminal inside the pg_tileserv_db container and runs the `shp2pgsql` command.

We can use `ogr2ogr` command line tool if your data is anything other than shapefile. Read this blog by [Kat Batuigas](https://blog.crunchydata.com/blog/loading-data-into-postgis-an-overview) to know how to do it.


Finally, run `docker-compose up` to start the service. You'd see both containers starting up and your web app being served on port 7800. If you do not see this, stop the container and run again.

![](https://i.imgur.com/Gy4QlTL.png)

On running the web app in the browser we see our tables visible under Table Layers and the schema it belongs to. We added a few additional layers (public.hydrants and a function layer following steps from `README.md`) to play around with it.


![](https://i.imgur.com/CwmhUdK.png)


## Endnote

We looked at serving vector data as tiles using pg_tileserv and docker container. Docker enables reproducibility and expedites the process of running a web app. Although there are numerous open-source tile servers available, each has its use case and would require testing them out to identify the best tileserver for your use case. You can read a long list of tileservers [here](https://github.com/mapbox/awesome-vector-tiles).

So next time you think to serve large vector data on the web app, make sure to use vector tiles built inside a docker container. It will surely simplify things!

Source: 
1. CrunchyData/pg_tileserv: A very thin PostGIS-only tile server in Go. Takes in HTTP tile requests, executes SQL, returns MVT tiles. (https://github.com/CrunchyData/pg_tileserv/)

2. Lightweight PostGIS Web Services Using pg tileserv and pg featureserv (https://www.youtube.com/watch?v=TXPtocZWr78&t=1s&ab_channel=CrunchyData)

3. Reference | Vector tiles | Mapbox (https://docs.mapbox.com/vector-tiles/reference/)

4. Vector Tiles – Geoinformation HSR (https://giswiki.hsr.ch/Vector_Tiles)
