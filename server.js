import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // در development همه origin ها مجاز
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection with fallback
const connectDB = async () => {
  try {
    // First try MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
    });
    console.log('✅ MongoDB Atlas متصل شد!');
  } catch (error) {
    console.log('⚠️  MongoDB Atlas connection failed, trying local fallback...');
    console.error('Atlas Error:', error.message);
    
    try {
      // Fallback to local MongoDB
      await mongoose.connect('mongodb://localhost:27017/boujig-local', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('✅ Local MongoDB متصل شد!');
    } catch (localError) {
      console.error('❌ هیچ دیتابیسی در دسترس نیست:', localError.message);
      console.log('🔧 لطفاً MongoDB Atlas یا MongoDB local نصب کنید');
    }
  }
};

connectDB();

// Basic request logger for debugging (باید قبل از routes باشد)
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl} from ${req.ip}`);
  next();
});

// Routes
import authRoutes from './routes/auth.js';
import boatRoutes from './routes/boats.js';
import vesselRoutes from './routes/vessels.js';
import crewRoutes from './routes/crew.js';
import fishingMethodRoutes from './routes/fishingMethods.js';
import fishingToolRoutes from './routes/fishingTools.js';
import boatTypeRoutes from './routes/boatTypes.js';
import sailorRoutes from './routes/sailor.js';

app.use('/api/vessels', vesselRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/boats', boatRoutes);
app.use('/api/crew', crewRoutes);
app.use('/api/fishing-methods', fishingMethodRoutes);
app.use('/api/fishing-tools', fishingToolRoutes);
app.use('/api/boats/boat-types', boatTypeRoutes);
app.use('/api/sailor', sailorRoutes);

// Simple ping endpoint for emulator connectivity checks
app.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: 'pong',
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Boujig API Server is running!',
    status: 'success',
    timestamp: new Date().toISOString(),
    server_ip: req.connection.localAddress,
    client_ip: req.connection.remoteAddress
  });
});

// Test endpoint for network debugging
app.get('/test', (req, res) => {
  import('os').then(os => {
    const networkInterfaces = os.networkInterfaces();
    res.json({
      message: 'Network Test Endpoint',
      networkInterfaces: networkInterfaces,
      timestamp: new Date().toISOString()
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'خطای داخلی سرور' 
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 سرور در حال اجرا روی پورت ${PORT}`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
  console.log(`📱 Flutter Emulator: http://10.0.2.2:${PORT}`);
  console.log(`� Flutter Real Device: http://YOUR_IP:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
