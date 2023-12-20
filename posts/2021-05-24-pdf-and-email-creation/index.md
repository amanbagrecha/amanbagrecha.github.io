---
title: Django rest framework PDF creation and email via gmail SMTP and reportLab
date: 2021-05-24
slug: pdf-and-email-creation
categories: [Django]
tags: []
subtitle: ''
description: 'In this blog we create PDF using `Report Lab` and email it to the user using gmail SMTP service. All actions are performed in Django.'
---

## Overview
Ever wanted to send email with attachements that too in django? And have the attachments created from the user input? This post tries to solve exactly that.

## Main steps
In this blog we create PDF using `Report Lab` and email it to the user using gmail SMTP service. All actions are performed in Django. 

## Step 1 : create django view to serialize data

To begin with, we create a view `CreatePDF` which accepts `POST` request and the data gets passed onto `CreatePDFSerializer` which serializes our data and validates it. If our data is valid, we generate PDF using `generate_pdf` function and email to the recipent (`emailaddress` of the users) using the `sendPDF` function. If everything does not execute properly, we return an error response else a success.

The local variable `myresponse` is a dictionary which helps us manage the response for each `return` statement in the correct format as expected by `response` method.


```python

SUCCESS = 'success'
ERROR = 'error'
message_list = ['response', 'status', 'message'] # eg: ["success", 201, "successfully upload the file"]

@csrf_exempt
@api_view(['POST',])
def CreatePDF(request):
    myresponse = {k: [] for k in message_list}

    try:
        myData = request.data
        # serialier the data
        serializer = serializers.CreatePDFSerializer(data=myData)  
        if serializer.is_valid():
            try:
                sendPDF(**myData.dict())  # create pdf and send email
            except Exception as e:
                RequestResponse(
                    myresponse,
                    ERROR,
                    status.HTTP_400_BAD_REQUEST,
                    {"Email": ["Could not send mail!"]},
                )
                return Response(data=myresponse)
            
            account = serializer.save()
            RequestResponse(
                myresponse,
                SUCCESS,
                status.HTTP_201_CREATED,
                {"Success": [f"Inspection Report e-mailed to {account.EmailAddress}!"]},
            )
            return Response(data=myresponse)

        RequestResponse(
            myresponse, ERROR, status.HTTP_400_BAD_REQUEST, serializer.errors
        )
        return Response(data=myresponse)
    
    except Exception as e:
        print(e)
        RequestResponse(
            myresponse,
            ERROR,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            {"Error": ["Internal Server Error"]},
        )
        return Response(data=myresponse)

```

## step 2: Generate PDF using Report Lab

In `views.py` we create a function to generate pdf using `Report Lab` package. This allows us to define the page size and line strings with text placement to be included.
```python
def generate_pdf(**Mydata):
    y = 700
    buffer = io.BytesIO()  # in memory create pdf
    p = canvas.Canvas(buffer, pagesize=letter)
    p.setFont('Helvetica', 14)
    p.drawString(220, y, Mydata['Title'])
    p.drawString(450, y, 'Date:' + timezone.now().strftime('%Y-%b-%d'))
    p.line(30, 675, 550, 675)
    p.drawString(220, y - 300, 'Time'
                 + str(Mydata['time']))
    p.showPage()
    p.save()
    pdf = buffer.getvalue()
    buffer.close()
    return pdf

```

## step 3: Send Email via SMTP backend

In `views.py`, we create `sendPDF` function which calls the `generate_pdf`to generate PDF and attaches the pdf to the email using the `EmailMessage` class method `attach`. We additionally need to setup backend for smtp service and host user which is to be done in `settings.py`.
```python
# views.py
def sendPDF(**Mydata):
	pdf = generate_pdf(**Mydata)
	msg = EmailMessage(Mydata['Title'], " Your Report is ready! ", settings.EMAIL_HOST_USER, to=[Mydata['EmailAddress']])
	msg.attach(f"{Mydata['Title']}.pdf", pdf, 'application/pdf')
	msg.content_subtype = "html"
	resp = msg.send()
	print("resp:" , resp)
```

In `settings.py`
```python
# settings.py
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = "smtp.gmail.com"
EMAIL_HOST_USER = 'your_email@gmail.com'
EMAIL_HOST_PASSWORD = 'your_password'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
```

At this point we have been able to successfully setup and send email with attachment. 

