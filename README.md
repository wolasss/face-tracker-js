# Face tracker

## Description
Program detects and follows user's head. This can be a base for applications like emotion detector, smile shutter etc.

## Model
There are few assumptions of this program:
- camera is stationary
- user is in front of the camera (preferably close)
- background behind the user is motionless

## Light
A lot depends on light. This can cause false positives and algorithm's malfunction. The light should be even as much as possible. 

## Algorithm
Algorithm is based on motion detection with binary difference image.

## Live demo
http://www.adamwolski.com/face-tracker
