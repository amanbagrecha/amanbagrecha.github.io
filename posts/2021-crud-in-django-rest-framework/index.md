---
title: Full Fledged CRUD application using DRF and Token Authentication
date: 25-02-2021
slug: crud-in-django-rest-framework
categories: [Django]
tags: [Django]
subtitle: ''
description: 'How to perform Create, Read, Update and Delete operations in Django Rest Framework'
featured: no
---


<hr style="border:1px solid lightgray"> </hr>

<br>

## What will you learn

<span style="color: grey;font-size: 18px;">Too Long; Didn't Read </span>

Markdown | Less 
--- | --- 
**DRF** | Create API end points for CRUD
**Token Authentication** |  Add security and authorised access
**Fetch API calls** | Consume API from front-end
**Password Reset** | Send email to reset your forgotton password

---

## 1. Step one : Basic Django Project setup

Create virtual environment

```
conda create --name djangoEnv
```

Activate the environment

```
conda activate djangoEnv
```
Install the dependencies

```
conda install django
```
Now, in your command line

create project `django-admin startproject tutorial`

create app `python manage.py startapp Accountsapp`

create superuser `python manage.py createsuperuser`

Now that we have the project and app installed your structure should look like this (insert picture here)

Register the app in  file as follows

In `settings.py`
```python
Installed_apps = [ 
    'Accountsapp.apps.AccountsappConfig',
    ...
]
```

We now create our own custom model named ***MyAccounts***

In `models.py`

```python
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token


class MyAccountManager(BaseUserManager):
	def create_user(self, email, username, password=None):
		if not email:
			raise ValueError('Users must have an email address')
		if not username:
			raise ValueError('Users must have a username')


		user = self.model(
			email=self.normalize_email(email),
			username=username,
		)

		user.set_password(password)
		user.save(using=self._db)
		return user

	def create_superuser(self, email, username, password):
		user = self.create_user(
			email=self.normalize_email(email),
			password=password,
			username=username,
			
		)
		user.is_admin = True
		user.is_staff = True
		user.is_superuser = True
		user.save(using=self._db)
		return user

# creating custom model of "User" base model. 
class MyAccount(AbstractBaseUser):
	email 					= models.EmailField(verbose_name="email", max_length=60, unique=True)
	username 				= models.CharField(max_length=30, unique=True)
	date_joined				= models.DateTimeField(verbose_name='date joined', auto_now_add=True)
	last_login				= models.DateTimeField(verbose_name='last login', auto_now=True)
	is_admin				= models.BooleanField(default=False)
	is_active				= models.BooleanField(default=True)
	is_staff				= models.BooleanField(default=False)
	is_superuser			= models.BooleanField(default=False)


	USERNAME_FIELD = 'email'   # username_field is the one which should be unique and will be compared by django for not creating multiple users with same email.

	REQUIRED_FIELDS = ['username'] 

	objects = MyAccountManager()

	def __str__(self):
		return self.email

	# For checking permissions. to keep it simple all admin have ALL permissons
	def has_perm(self, perm, obj=None):
		return self.is_admin

	# Does this user have permission to view this app? (ALWAYS YES FOR SIMPLICITY)
	def has_module_perms(self, app_label):
		return True
```

To tell django we are overwriting the default user model, we do the following

In `settings.py`
```python
AUTH_USER_MODEL = Accounts.MyAccounts
```

Now we makemigrates to register the model in our database

```
python manage.py makemigrations
python manage.py migrate
```

And for the model to be visible in admin section we do the following

In `admin.py`
```python
from django.contrib import admin
from .models import MyAccount

admin.site.register(MyAccount) # Register your models here.
```

For now the our project is setup. We move to Django Rest Framework setup

## 2. Setup Django Rest Framework with Authentication

Install dependeny
``` 
conda install djangorestframework
```

Like any other app, django rest framework is also an app. so we add it to the list of installed apps. 
We additionally add authtoken app for user authentication which we are shortly going to intergrate in our CRUD application

In `settings.py`

```python
INSTALLED_APPS = [
    # my apps
    'Accountsapp.apps.AccountsappConfig',
    # restframework
    'rest_framework',
    'rest_framework.authtoken',
    ...
    
]
```

We are going to be using Token Authentication in this application. DRF documentation recommends it as the default. 
Let Us setup the Default authentication class before actually utilising it.

In `settings.py` 
```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        
    ]
}
```
The last thing before we actually start writing code is to perform migration. The `rest_framework.authtoken` app provides Django database migrations.

As done previously on command line
```
python manage.py makemigrations
python manage.py migrate
```
We have completed the logistics for setting up DRF

## 3. Building CRUD application 

We would first create a folder called **api** inside our to seperate codebase for API and vanila CRUD

Inside API folder create four files,

- `__init__.py`
- `serializers.py`
- `views.py`
- `urls.py`


In `serializers.py`

```python
from rest_framework import serializers 
from Accountsapp.models import MyAccount # import our custom model


# provide fields in meta, expression and in MyAccount. for admin page login and edit,  is_admin and is_staff should be true
class RegistrationSerializer(serializers.ModelSerializer):

    # additional fields 
	password2 = serializers.CharField(style={'input_type': 'password'}, write_only=True)
	is_superuser =serializers.BooleanField(write_only=True)
	
    class Meta:
		model = MyAccount
        # mention the fields you want to display when request is sent. 
		fields = ['id','email', 'username', 'password', 'password2',  'is_superuser']
		extra_kwargs = {
				'password': {'write_only': True},  # tells django to not display the password for others to see
		}	


	def	save(self):

		account = MyAccount(
					email=self.validated_data['email'],
					username=self.validated_data['username'],
					# is_admin=self.validated_data['is_admin'],
					is_superuser= self.validated_data['is_superuser'],
				)
		password = self.validated_data['password']
		password2 = self.validated_data['password2']
		if password != password2:
			raise serializers.ValidationError({'password': 'Passwords must match.'})
		account.set_password(password)
		account.save()
		return account


class UpdateSerializer(serializers.ModelSerializer):

	class Meta:
		model = MyAccount
		# mention the fields you want to display when request is sent. 
		fields = ['id', 'username', 'email']
		extra_kwargs = {
				'password': {'read_only': True},  #  password cannot be edited from here
		}


```
**Note** : Do not try to update the password from serializers. There is another technique which we will deal with in later section.

> The serializers in REST framework work very similarly to Django’s Form and ModelForm classes. The two major serializers that are most popularly used are ModelSerializer and HyperLinkedModelSerialzer.


In `views.py`

```python
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.contrib.auth import authenticate
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes

from . import serializers 
from Accountsapp.models import MyAccount
from rest_framework.authtoken.models import Token

# user views
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.parsers import JSONParser
from django.core.exceptions import ObjectDoesNotExist
import json

# login {built-in django}
from django.contrib.auth import login 
from django.contrib.auth.decorators import login_required



# get all users
@api_view(["GET"])
@csrf_exempt
@permission_classes([IsAuthenticated,])
@authentication_classes([TokenAuthentication])
def get_users(request):
    try:
        user_profile = MyAccount.objects.all() 
        serializer = serializers.RegistrationSerializer(user_profile, many=True)
        return Response( {'USER_PROFILE':serializer.data}, status= status.HTTP_200_OK)
    except ObjectDoesNotExist:
        return JsonResponse({'Response': 'You do not have authorization to access this page'}, status=status.HTTP_401_UNAUTHORIZED)



# get given user
@api_view(['GET'])
@csrf_exempt
@permission_classes([IsAuthenticated,])
@authentication_classes([TokenAuthentication])
def get_given_user(request, pk):
    try:
        user_profile = MyAccount.objects.get(pk=pk)
    except ObjectDoesNotExist:
        return JsonResponse({"missing": "The requested object does not exist"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':  
        serializer = serializers.RegistrationSerializer(user_profile)
        token = Token.objects.get(user=user_profile).key
        return JsonResponse({'given_user_profile': serializer.data, 'token':token})
   


# add user
@csrf_exempt
@api_view(['POST'])
def user_add_view(request):
        serializer = serializers.RegistrationSerializer( data=request.data)
        if serializer.is_valid():
            account = serializer.save()
            token, _ = Token.objects.get_or_create(user=account)
            return Response(serializer.data, status=status.HTTP_201_CREATED,  headers={'Authorization': 'Token ' + token.key})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



# update user
@api_view(["PUT",'GET'])
@csrf_exempt
@permission_classes([IsAuthenticated,])
@authentication_classes([TokenAuthentication])
def update_user(request, pk):

    try:
        user_profile = MyAccount.objects.get(id=pk)
    except ObjectDoesNotExist:
        return Response({'response': "given object does not exist"}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    try:
        data =  {i:j for i,j in request.query_params.items()}
        print(data)
        serializer = serializers.UpdateSerializer(user_profile, data=data)
        if serializer.is_valid():
            user= serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response({"response": "success", 'data' :serializer.data}, status=status.HTTP_201_CREATED,  headers={'Authorization': 'Token ' + token.key})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    except ObjectDoesNotExist as e:
        return JsonResponse({'error': str(e)}, safe=False, status=status.HTTP_404_NOT_FOUND)
    except Exception:
        return JsonResponse({'error': 'Something terrible went wrong'}, safe=False, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



# delete user
@api_view(["DELETE",'GET']) 
@csrf_exempt
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def delete_user(request, pk):

    try:
        user_profile = MyAccount.objects.get(id=pk)
    except ObjectDoesNotExist:
        return JsonResponse({'response': "given object does not exist"}, safe=False, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    if user_profile != user: 
        return JsonResponse({'response':"You don't have permission to delete the record."}, safe=False, status=status.HTTP_401_UNAUTHORIZED)

    try:
        user_profile.delete()  #retuns 1 or 0
        return JsonResponse({'user_delete': "record deleted"}, safe=False, status=status.HTTP_200_OK)
    except ObjectDoesNotExist as e:
        return JsonResponse({'error': str(e)}, safe=False, status=status.HTTP_404_NOT_FOUND)
    except Exception:
        return JsonResponse({'error': 'Something terrible went wrong'}, safe=False, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



# login view and get token
@api_view(["POST", ])
def drflogin(request):

    email = request.data.get("email")
    username = request.data.get("username")
    password = request.data.get("password")
    account = MyAccount.objects.filter(email=email) | MyAccount.objects.filter(username=username)
    if not account:
        return Response({"error": "Login failed"}, status=status.HTTP_401_UNAUTHORIZED)
    # authenticate(email=email, password=password)  # returns none if not authenticated
    account = authenticate(email=account[0].email, password=password)
    token, _ = Token.objects.get_or_create(user=account)
    login(request,account)  
    renderer= Response({"response" : "Successfully authenticated",  "pk": account.pk, "username": account.username, "token": token.key }, template_name= "Accountsapp/loginuser.html", headers={'Authorization': 'Token ' + token.key})
    return renderer
```

Setup end points for our API


In `views.py`
```python

from django.urls import path, include
from . import views as drf_views


app_name = 'Accountsapp'

urlpatterns = [

    path('drf_users/', drf_views.get_users, name= 'drf_users'),
    path('drf_user/<int:pk>/', drf_views.get_given_user, name= 'drf_get_user'),
    path('drf_updateuser/<int:pk>/', drf_views.update_user, name= 'drf_updateusers'),
    path('drf_deleteuser/<int:pk>/', drf_views.delete_user, name= 'drf_deleteuser'),
    path('drf_adduser/', drf_views.user_add_view, name= 'drf_adduser'),
    path('drf_login/', drf_views.drflogin, name='drf_login'),

    
]

```

We first create users and then test  delete, update and show users functionality of our API. We will use Postman for timebeing. Later we will built the front-end to perform all these actions. 

## <span style= "color:orange"> POST </span> REQUEST: **ADD USER**

```
http://127.0.0.1:8000/drf_adduser/
```


![](https://i.imgur.com/Ea8W3Bj.png)


## <span style= "color:green"> GET </span> REQUEST: **GET USERS**

API end point
```
http://127.0.0.1:8000/drf_users/
```

Using curl and passing authorization token
```
curl --location --request GET 'http://127.0.0.1:8000/drf_users/' \
--header 'Authorization: Token 92cc8c32edb7bd111b89552a3031f918d2df5613'
```

Using postman

![](https://i.imgur.com/dPnv4J4.png)



## <span style= "color:RED"> DEL </span> REQUEST: **DELETE USER**

API end point
```
http://127.0.0.1:8000/drf_deleteuser/<int:pk>
```
Using curl and passing authorization token
```
curl --location --request DELETE 'http://127.0.0.1:8000/drf_deleteuser/21' \
--header 'Authorization: Token 1529e77c59999f819649828a5e9174ba44bd6bb4'
```
Using postman

![](https://i.imgur.com/6IFah1s.png)


## <span style= "color:dodgerblue"> PUT </span> REQUEST: **UPDATE USER**

API end point
```
http://127.0.0.1:8000/drf_updateuser/1/?username=updated_username_here&email=updated_email_here
```

Using curl and passing authorization token
```
curl --location --request PUT 'http://127.0.0.1:8000/drf_updateuser/8/?username=rcbfl&email=rcbfl@gmail.com' \
--header 'Authorization: Token 506ce0bbf7fa50f613678024586669d9b6bd82a0'
```
using postman
![](https://i.imgur.com/LhVZ34L.png)


## <span style= "color:green"> GET </span> REQUEST: **GET USER**

API end point
```
http://127.0.0.1:8000/drf_user/<int:pk>
```

Using curl and passing authorization token
```
curl --location --request GET 'http://127.0.0.1:8000/drf_user/8' \
--header 'Authorization: Token 506ce0bbf7fa50f613678024586669d9b6bd82a0'
```
using postman

![](https://i.imgur.com/LiPdZIe.png)



## Front end setup

In root directory create folder  `templates\Accountsapp\` and create `RegiserUser.html` file in it. Create form field in the file as follows

```html
          <form class="form-horizontal" action="" method="post"  id="myForm" autocomplete="off">
          	{% csrf_token %}
            <!-- Name input-->
            <div class="form-group">
              <label class="col-md-3 control-label" for="username">Name</label>
              <div class="col-md-9">
                <input id="username" name="username" type="text" placeholder="Your username" class="form-control">
              </div>
            </div>
            <!-- Email input-->
            <div class="form-group">
              <label class="col-md-3 control-label" for="email">Your E-mail</label>
              <div class="col-md-9">
                <input id="email" name="email" type="email" placeholder="Your email" class="form-control">
              </div>
            </div>
            <!-- password body -->
            <div class="form-group">
              <label class="col-md-3 control-label" for="password">Password</label>
              <div class="col-md-9">
                <input id="password" name="password" type="password" placeholder="Your password" class="form-control">
              </div>
            </div>
            <!-- password body -->
            <div class="form-group">
              <label class="col-md-3 control-label" for="password2">Password2</label>
              <div class="col-md-9">
                <input id="password2" name="password2" type="password" placeholder="confirm password" class="form-control">
              </div>
            </div>
            
            <!-- superuser input -->
            <div class="form-group">
              <label class="col-md-3 control-label" for="superuser">Is superuser</label>
              <div class="col-md-3">
                <input id="issuperuser" name="issuperuser" type="checkbox"  class="form-control" >
              </div>
            </div>
 
    
            <!-- Form actions -->
            <div class="form-group">
              <div class="col-md-6 text-left">
                <button type="submit" class="btn btn-primary btn-lg">Submit</button>
              </div>


            </div>
          </fieldset>
          </form>

```

Once the form is created, we now need to take the input from the form and send to the register user API `drf_adduser/`.

In `RegisterUser.html`
```html
<script type="text/javascript">


			function getCookie(name) {
		    var cookieValue = null;
		    if (document.cookie && document.cookie !== '') {
		        var cookies = document.cookie.split(';');
		        for (var i = 0; i < cookies.length; i++) {
		            var cookie = cookies[i].trim();
		            // Does this cookie string begin with the name we want?
		            if (cookie.substring(0, name.length + 1) === (name + '=')) {
		                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
		                break;
		            }
		        }
		    }
		    return cookieValue;
		}
		var csrftoken = getCookie('csrftoken');



function fetchcall(event) {

		event.preventDefault();
		console.log('form submitted');
	var username = document.getElementById("username").value;
	var email = document.getElementById("email").value;
	var password = document.getElementById("password").value;
	var password2 = document.getElementById("password2").value;
	var issuperuser = document.getElementById(('issuperuser')).checked;
	console.log(issuperuser)

		var url = '/drf_adduser/';

			fetch(url, {
				method:'POST',
				headers:{
					'Content-type':'application/json',
					'X-CSRFToken':csrftoken,
				},
				body:JSON.stringify({
					'email':email,
					'username':username,
					"password":password,
					"password2":password2,
					"is_superuser": issuperuser
				})
			}
			).then(function(response){
				store_response= response;
				return response.json();

			}).then(function(data){
				store_data =JSON.stringify(data);
				document.getElementById("message").innerHTML=  store_data;
			}).catch(function(error){
			console.error(error);
		});

	}
			
	var myForm = document.getElementById("myForm");

		console.log(username, password, myForm);
	myForm.addEventListener('submit', fetchcall);
	
</script>
```

To make this work in front-end, we need to register the file to `Accountsapp/views.py` 
```python
def register_user(request):
	# if request.user.is_authenticated:
	return render(request, "Accountsapp/RegisterUser.html", {'Title': "Register new user"})

```
