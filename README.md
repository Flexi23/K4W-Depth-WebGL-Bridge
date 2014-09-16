Kinect for Windows depth texture WebGL viewer
======================

The whole thing is kept deliberately simple. You just need a Kinect for Windows v2 and the SDK2.0,
Visual Studio to compile the framegrabbers, and a WebGL-enabled browser. Even IE 11 should do fine.
The C# code writes the raw depth data to a file as soon as it receives a new frame from the sensor.
The Javascript client reads from the file on every animation frame and loads it in a WebGL texture.
Animations work too but beware the amount of the uncompressed data: 19MB/s is over 1GB in a minute.

In case you don't have a sensor, you can download some test data here:
http://www.mediafire.com/download/9m3r93e4rzrdej5/kinect2.depth.frame.zip
