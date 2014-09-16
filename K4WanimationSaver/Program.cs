using Microsoft.Kinect;
using System;
using System.IO;

namespace Kinect2DepthFileWriter
{
	class Program
	{
		static private string fileName = @"C:\Users\Public\Pictures\kinect2.depth.frame.series";

		static private BinaryWriter writer;
		static private DepthFrameReader reader = null;

		static void Main(string[] args)
		{
			var sensor = KinectSensor.GetDefault();
			sensor.Open();
			writer = new BinaryWriter(new FileStream(fileName, FileMode.OpenOrCreate, FileAccess.Write));
			System.Console.WriteLine("File opened: " + fileName);
			reader = sensor.DepthFrameSource.OpenReader();
			reader.FrameArrived += Reader_FrameArrived;
			Console.WriteLine("Press Enter to stop recording.");
			Console.Read();
			reader.FrameArrived -= Reader_FrameArrived;
			reader.Dispose();
			sensor.Close();

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
						for (int i = 0; i < 424 * 512; ++i)
						{
							byte lsb = (byte)(data[i] & 0xFFu);
							byte msb = (byte)((data[i] >> 8) & 0xFFu);
							writer.Write(msb);
							writer.Write(lsb);
							writer.Write((byte)0);
						}
                        writer.Flush();
                    }
				}
			}
		}
	}
}