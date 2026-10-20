const MAX_IMAGE_FILE_SIZE = 20 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1000;

export const compressImage = (file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) {
        return Promise.reject(new Error('Vui lòng chọn tệp hình ảnh.'));
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
        return Promise.reject(new Error('Ảnh vượt quá 20 MB. Vui lòng chọn ảnh nhỏ hơn.'));
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Không thể đọc ảnh ${file.name}.`));
        reader.onload = () => {
            if (typeof reader.result !== 'string') {
                reject(new Error(`Không thể đọc ảnh ${file.name}.`));
                return;
            }

            const image = new Image();
            image.onerror = () => reject(new Error(`Tệp ${file.name} không phải ảnh hợp lệ.`));
            image.onload = () => {
                const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
                const width = Math.max(1, Math.round(image.width * scale));
                const height = Math.max(1, Math.round(image.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const context = canvas.getContext('2d');
                if (!context) {
                    reject(new Error('Trình duyệt không thể xử lý ảnh này.'));
                    return;
                }

                context.drawImage(image, 0, 0, width, height);
                try {
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } catch {
                    reject(new Error(`Không thể xử lý ảnh ${file.name}.`));
                }
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
};
