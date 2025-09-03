import fetch from 'node-fetch';

class SMSService {
  constructor() {
    // Don't load API key in constructor - load it when needed
  }

  getApiKey() {
    return process.env.KAVEH_NEGAR_API_KEY;
  }

  // ارسال کد تأیید
  async sendVerificationCode(mobile, code) {
    try {
      console.log(`📤 کاوه نگار: ارسال پیامک به ${mobile}: ${code}`);
      
      const apiKey = this.getApiKey();
      const enableRealSMS = process.env.ENABLE_REAL_SMS === 'true';
      
      console.log(`🔑 API Key موجود: ${apiKey ? 'بله' : 'خیر'}`);
      console.log(`📳 پیامک واقعی: ${enableRealSMS ? 'فعال' : 'غیرفعال'}`);

      // اگر ENABLE_REAL_SMS غیرفعال باشه، فقط log کن
      if (!enableRealSMS) {
        console.log(`🔔 [DEV MODE] SMS به ${mobile}: کد تأیید شما: ${code}`);
        return {
          success: true,
          message: 'پیامک در حالت توسعه ارسال شد (log only)',
          messageId: 'dev_' + Date.now(),
          dev_mode: true
        };
      }

      if (!apiKey) {
        console.error('❌ کلید API کاوه نگار موجود نیست!');
        throw new Error('کلید API کاوه نگار پیکربندی نشده است');
      }

      // ارسال پیامک با کاوه نگار
      const message = `کد تأیید شما: ${code}`;
      const url = `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json?receptor=${mobile}&token=${code}&template=OTP`;

      console.log(`🌐 درخواست به کاوه نگار: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);
      
      const response = await fetch(url);
      const data = await response.json();

      console.log('📱 نتیجه ارسال پیامک کاوه نگار:', data);

      if (data.return && data.return.status === 200) {
        return {
          success: true,
          message: 'پیامک ارسال شد',
          messageId: data.entries ? data.entries[0].messageid : null,
          details: data
        };
      } else {
        throw new Error(`خطا در ارسال پیامک: ${data.return ? data.return.message : 'خطای نامشخص'}`);
      }

    } catch (error) {
      console.error('❌ خطا در ارسال پیامک کاوه نگار:', error);
      
      // در صورت خطا، حداقل کد رو log کنیم تا توسعه متوقف نشه
      console.log(`🔔 [FALLBACK] کد تأیید برای ${mobile}: ${code}`);
      
      return {
        success: false,
        error: 'خطا در ارسال پیامک',
        fallback_code: code // فقط برای توسعه
      };
    }
  }

  // ارسال پیامک عمومی
  async sendMessage(mobile, message) {
    try {
      console.log(`📤 ارسال پیامک به ${mobile}: ${message}`);

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔔 [DEV MODE] SMS به ${mobile}: ${message}`);
        return { success: true, message: 'پیامک در حالت توسعه ارسال شد' };
      }

      const apiKey = this.getApiKey();
      
      // ارسال پیامک با کاوه نگار - روش ساده
      const url = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json?receptor=${mobile}&message=${encodeURIComponent(message)}&sender=10008566`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.return && data.return.status === 200) {
        return {
          success: true,
          message: 'پیامک ارسال شد',
          messageId: data.entries ? data.entries[0].messageid : null
        };
      } else {
        throw new Error(`خطا در ارسال پیامک: ${data.return ? data.return.message : 'خطای نامشخص'}`);
      }

    } catch (error) {
      console.error('خطا در ارسال پیامک:', error);
      return {
        success: false,
        error: 'خطا در ارسال پیامک'
      };
    }
  }

  // بررسی وضعیت پیامک
  async getDeliveryStatus(messageId) {
    try {
      const apiKey = this.getApiKey();
      const url = `https://api.kavenegar.com/v1/${apiKey}/sms/status.json?messageid=${messageId}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.return && data.return.status === 200) {
        return {
          success: true,
          status: data.entries ? data.entries[0].status : 'unknown'
        };
      } else {
        throw new Error(`خطا در دریافت وضعیت: ${data.return ? data.return.message : 'خطای نامشخص'}`);
      }

    } catch (error) {
      console.error('خطا در دریافت وضعیت پیامک:', error);
      return {
        success: false,
        error: 'خطا در دریافت وضعیت'
      };
    }
  }
}

export default new SMSService();
