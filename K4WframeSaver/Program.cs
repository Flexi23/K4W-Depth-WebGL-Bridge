using Microsoft.Kinect;
using System;
using System.IO;

namespace Kinect2DepthFileWriter
{
	class Program
	{
		static private string fileName = @"C:\Users\Public\Pictures\kinect2.depth.frame";

		static private BinaryWriter writer;
		static private DepthFrameReader reader = null;

		static void Main(string[] args)
		{
			var sensor = KinectSensor.GetDefault();
			sensor.Open();
			writer = new BinaryWriter(new FileStream(fileName, FileMode.OpenOrCreate, FileAccess.Write));
			reader = sensor.DepthFrameSource.OpenReader();
			reader.FrameArrived += Reader_FrameArrived;
			Console.Read();
		}

		unsafe private static void Reader_FrameArrived(object sender, DepthFrameArrivedEventArgs e)
		{
			using (DepthFrame frame = e.FrameReference.AcquireFrame())
			{
				if (frame != null)
				{
					using (var buffer = frame.LockImageBuffer())
					{
						ushort* data = (ushort*)buffer.UnderlyingBuffer;
						writer.Seek(0, SeekOrigin.Begin);
						for (int i = 0; i < 424 * 512; ++i)
						{
							byte lsb = (byte)(data[i] & 0xFFu);
							byte msb = (byte)((data[i] >> 8) & 0xFFu);
							writer.Write(msb);
							writer.Write(lsb);
							writer.Write((byte)0); // to be put in a WebGL texture read as ArrayBuffer using a Int8Array view
						}
						writer.Flush();
					}
				}
			}
		}
	}
}
