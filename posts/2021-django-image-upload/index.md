---
title: How to Upload Multiple Geotagged Images in Django
date: 16-03-2021
slug: django-image-upload
categories: [Django]
tags: []
subtitle: ''
description: 'we look into how to upload multiple geo-tagged/non-geotagged images to aws s3 using plain Django and postgresql as databbase.'
---

## Overview



In this post, we look into how to upload multiple geo-tagged/non-geotagged images to aws s3 using plain Django and spatialite as databbase. We use GeoDjango to store the latitude, longitude extracted from geo-tagged images into the database.



<br>
<hr>

### Project setup

create django project 
```bash
django-admin startproject login_boiler_plate
create app python manage.py startapp GisMap
create superuser python manage.py createsuperuser
```

In `settings.py` add the app to `installed_app` list and setup the default location for media storage.
```python
INSTALLED_APPS = [
	...
	'GisMap',
]

MEDIA_ROOT =  os.path.join(BASE_DIR, 'media') 
MEDIA_URL = '/media/'
```


### **Setup the database backend to postgis extenstion of postgresql.**

```python
# in settings.py file
DATABASES = {
	'default': {
		 'ENGINE': 'django.contrib.gis.db.backends.postgis', #imp
		 'NAME': 'database_name_here',
		 'USER': 'postgres',
		'PASSWORD': 'password_here',
		'HOST': 'localhost',
		'PORT': '5432',
	},
}
```

In `models.py`, create model for uploading images. `DateTimeField` and `user` are not necessary.
```python
from django.db import models
from django.contrib.auth.models import User


class ImageUpload(models.Model):
	user = models.ForeignKey(User, null=True, on_delete=models.CASCADE)
	image = models.ImageField( null=False, blank=False, upload_to = 'images/')
	date_created = models.DateTimeField(auto_now_add=True, null=True)

	def __str__(self):
		return self.user.username + " uploaded: "+ self.image.name
```

In `forms.py`, refer to the ImageUpload model for input.
```python
  
from django.forms import ModelForm
from django.contrib.auth.models import User
from .models import ImageUpload

class ImageForm(ModelForm):
	class Meta:
		model = ImageUpload
		fields = ('image',)

```



In `home.html`, create the form to accept image upload. 
```html
                  <!-- Modal -->
                  <form method = "post" enctype="multipart/form-data">
                  <div class="modal fade" id="exampleModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true" >
                    {% csrf_token %}
                    <div class="modal-dialog" role="document">
                      <div class="modal-content">
                        <div class="modal-header">
                          <h5 class="modal-title" id="exampleModalLabel">Upload Image</h5>
                          <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                          </button>
                        </div>
                        <div class="modal-body">
                          {{ image_form.image }}
                        </div>
                        <div class="modal-footer">
                          <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                          <button type="submit" class="btn btn-primary">Save Image</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  </form>

```

In `views.py`, accept the HTTP POST request and save to the database. We will alter this to extract latitude, longitude later. 


```python
@login_required(login_url='login')
def home_page(request):

	if request.method == 'POST':
		form = ImageForm(request.POST , request.FILES)
		print(form)
		if form.is_valid():
			print("is valid")
			obj = form.save(commit=False)
			obj.user = request.user
			obj.save()
		return redirect('home')
	else:
		Imageform = ImageForm()
		return render(request, "GisMap/home.html", {'Title': "Home Page", "image_form": ImageForm})

```



###  Get Lat, lon from image meta deta (Exchangeable image file format [EXIF] )

1. Geodjango is built on top of django and adds spatial functionality such as storing points, lines , polygon and multipolygon. It is prepackaged with Django but requires few additional softwares to make it fully functional. These include- GDAL, PROJ, GEOS, PostGIS. These can be downloaded from osgeo4W which bundles all these libraries. Then application can be added to apps in settings with `django.contrib.gis` to the installed apps.



By default geodjango is not installed in the apps list and thus we do it ourself.
 
```
pip install django-geo
```

NOTE- ensure os4geo is installed: install from [here](https://qgis.org/en/site/forusers/download.html) if not done.  And make the following changes in `settings.py`. 


An additional setting is required, which is to locate osgeo4w directory in django. If you install osgeo4w in default directory, you need to put the following code within the settings.py file. 

```python
INSTALLED_APPS = [
...
	'django.contrib.gis',
]



import os
import posixpath
if os.name == 'nt':
	import platform
	OSGEO4W = r"C:\OSGeo4W"
	if '64' in platform.architecture()[0]:
		OSGEO4W += "64"
	assert os.path.isdir(OSGEO4W), "Directory does not exist: " + OSGEO4W
	os.environ['OSGEO4W_ROOT'] = OSGEO4W
	os.environ['GDAL_DATA'] = OSGEO4W + r"\share\gdal"
	os.environ['PROJ_LIB'] = OSGEO4W + r"\share\proj"
	os.environ['PATH'] = OSGEO4W + r"\bin;" + os.environ['PATH']

```






In `models.py`, add a PointField which can store geospatial information (lat,lon)
```python
from django.contrib.gis.db import models
class ImageUpload():
  ...  
  geom = models.PointField( null=True)
```

In `views.py`, define functions to extract meta data from image and convert into right format for GeoDjango to understand it. Courtesy of [Jayson DeLancey](https://developer.here.com/blog/getting-started-with-geocoding-exif-image-metadata-in-python3)

```python

#________________________________________FUNCTIONS FOR IMAGE EXIF DATA______________________________________________________________________________#



from PIL import Image
from urllib.request import urlopen
from PIL.ExifTags import GPSTAGS
from PIL.ExifTags import TAGS

def get_decimal_from_dms(dms, ref):

	degrees = dms[0]
	minutes = dms[1] / 60.0
	seconds = dms[2] / 3600.0

	if ref in ['S', 'W']:
		degrees = -degrees
		minutes = -minutes
		seconds = -seconds

	return round(degrees + minutes + seconds, 5)

def get_coordinates(geotags):
	lat = get_decimal_from_dms(geotags['GPSLatitude'], geotags['GPSLatitudeRef'])

	lon = get_decimal_from_dms(geotags['GPSLongitude'], geotags['GPSLongitudeRef'])

	return (lon, lat)



def get_geotagging(exif):
	if not exif:
		raise ValueError("No EXIF metadata found")

	geotagging = {}
	for (idx, tag) in TAGS.items():
		if tag == 'GPSInfo':
			if idx not in exif:
				raise ValueError("No EXIF geotagging found")

			for (key, val) in GPSTAGS.items():
				if key in exif[idx]:
					geotagging[val] = exif[idx][key]

	return geotagging

#_______________________________________________________________________________________________________________________________________#


```

In `views.py`, update home_page function to extract meta data and save the image to database.
```python
from django.contrib.gis.geos import Point

@login_required(login_url='login')
def home_page(request):
    if request.method == "POST":
        form = ImageForm(request.POST, request.FILES)
        img = Image.open(request.FILES.get("image"))
        if form.is_valid():
            try:
                obj = form.save(commit=False)
                obj.user = request.user
                obj.image_url = obj.image.url
                geotags = get_geotagging(img._getexif())
                obj.geom = Point(
                    get_coordinates(geotags)
                )  # X is longitude, Y is latitude, Point(X,Y)
                obj.save()
                messages.success(request, f"image uploaded succesfully")
            except ValueError as e:
                messages.warning(request, e)
        else:
            messages.warning(request, f"Invalid image type")
        return redirect("home")
    else:
        Imageform = ImageForm()
        return render(
            request, "GisMap/home.html", {"Title": "Home Page", "image_form": ImageForm}
        )
```

## Upload to S3 bucket


Install boto3 package and django-storages. Add to installed packages. Additionally, provide Key:Value AWS credentials to access the bucket and change the default file storage to S3.
```bash
pip install django-storages
pip install boto3
```


in `settings.py`
```python
INSTALLED_APPS = [
	...
	'storages',
]

AWS_ACCESS_KEY_ID = ""
AWS_SECRET_ACCESS_KEY = ""
AWS_STORAGE_BUCKET_NAME = ""

AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = None

DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

AWS_QUERYSTRING_AUTH = False // removes the query string
```

**NOTE: Make the bucket public to be able to make HTTP request**

Provide policy to make our s3 bucket public. By default, the bucket is private and no read/wrtie access is provided for user from outside the s3 page. There are other ways to access private bucket by either Limiting access to specific IP addresses or Restricting access to a specific HTTP referer. For simplicity we make the bucket public. 
```json
{
  "Version":"2012-10-17",
  "Statement":[
    {
      "Sid":"PublicRead",
      "Effect":"Allow",
      "Principal": "*",
      "Action":["s3:GetObject","s3:GetObjectVersion"],
      "Resource":["arn:aws:s3:::DOC-EXAMPLE-BUCKET/*"]
    }
  ]
}
```



## Accept non-geotagged images

At this point, we should be able to upload geotagged images to s3 bucket. Non-geotagged images are not yet accepted by the model and thus we create seperate model for it.

[Additional resource](https://stackoverflow.com/questions/34006994/how-to-upload-multiple-images-to-a-blog-post-in-django)

We now make separate model for accepting non-geotagged images similar to `ImageUpload` model but without `PointField`.
```python
class Photos(models.Model):

	user = models.ForeignKey(User, null=True, on_delete=models.CASCADE)
	image = models.ImageField(upload_to='photos/',null=True,blank=False)
	date_created = models.DateTimeField(auto_now_add=True, null=True)
	image_url = models.URLField(max_length=250, null=True, blank=False)

	class Meta:
		verbose_name = 'Photo'
		verbose_name_plural = 'Photos'

	def __str__(self):
		return self.user.username + " uploaded image "+ self.image.name
```


In `views.py` file, extend the home_page function to add a fallback for non-geotagged images. 

```python
if request.method == "POST":

    # images will be in request.FILES
    post_request, files_request = request.POST, request.FILES

    form = PhotoForm(post_request or None, files_request or None)
    files = request.FILES.getlist(
        "images"
    )  # returns files: [<InMemoryUploadedFile: Image_name.jpg (image/jpeg)>, <InMemoryUploadedFile: Image_name.jpg (image/jpeg)>]
    if form.is_valid():
        user = request.user
        for f in files:

            # returns <PIL.JpegImagePlugin.JpegImageFile image mode=RGB size=480x360 at 0x1ED0CCC6280>
            img = Image.open(f)  
            
            try:
                geotags = get_geotagging(img._getexif())
                geoimage = ImageUpload(user=user, image=f)
                geoimageimg_upload.image_url = geoimage.image.url
                # X is longitude, Y is latitude, Point(X,Y) ; returns eg SRID=4326;POINT (11.88454 43.46708)
                geoimage.geom = Point(get_coordinates(geotags))
                geoimage.save()
            except:
                nongeoimage = Photos(user=user, image=f)
                nongeoimage.image_url = nongeoimage.image.url
                nongeoimage.save()
    else:
        print("Form invalid")
    return redirect("home")
else:
    Imageform = PhotoForm()
    return render(
        request, "GisMap/home.html", {"Title": "Home Page", "image_form": ImageForm}
    )
```

## Accept multiple images

Make a new form which accepts multiple image files to be uploaded at once.
```python
class PhotoForm(forms.ModelForm):
	images = forms.FileField(widget=forms.ClearableFileInput(attrs={'multiple': True}))

	class Meta:
		model = Photos
		fields = ('images',)
```


In `home.html`, add `multiple` attribute to allow for multiple selection of images at once.
```html
				<div class="form-group">
				<label for="note-image"></label>
				<input type="file" name="images" class="form-control-file" id="note-image" multiple>
				</div>
```

## Final Note:
At this point, you should be able to upload multiple Images to the AWS S3 bucket and have coordinates extracted the geo-tagged images and segregate non-geotagged images. 

You learnt-

- How to Setup GeoDjango
- How to Setup AWS S3 bucket
- How to Extract meta data from Image and store in database using PointField

> These steps will ensure you have multiple images uploaded at once and all the geolocation information can be stored in database, which later can be import to QGIS for data visualisation. Although both postgresql and django admin allows users to visualise the data.
