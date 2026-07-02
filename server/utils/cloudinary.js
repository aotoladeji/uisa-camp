const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a file (path or buffer) to Cloudinary.
 * @param {string|Buffer} file - Local path or buffer.
 * @param {string} folder - Destination folder in Cloudinary.
 * @param {string} publicId - Optional public ID.
 * @returns {Promise<string>} - The secure URL of the uploaded image.
 */
async function uploadToCloudinary(file, folder = 'uisa-camp', publicId = null) {
  return new Promise((resolve, reject) => {
    const options = {
      folder,
      resource_type: 'auto',
    };
    if (publicId) options.public_id = publicId;

    if (Buffer.isBuffer(file)) {
      cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }).end(file);
    } else {
      cloudinary.uploader.upload(file, options, (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      });
    }
  });
}

module.exports = {
  uploadToCloudinary
};
