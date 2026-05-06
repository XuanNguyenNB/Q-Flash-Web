export type WorkflowErrorCode =
  | "HTTPS_REQUIRED"
  | "WEBUSB_UNAVAILABLE"
  | "USB_PICKER_CANCELLED"
  | "DEVICE_NOT_FOUND"
  | "UNSUPPORTED_PRODUCT"
  | "WRONG_PRODUCT"
  | "ADB_UNAUTHORIZED"
  | "SELINUX_NOT_PERMISSIVE"
  | "HASH_MISMATCH"
  | "FASTBOOT_FAILED"
  | "USB_DISCONNECTED"
  | "ANTIROLLBACK_FAILED"
  | "CONFIRMATION_REQUIRED"
  | "MANIFEST_INVALID"
  | "ASSET_FETCH_FAILED"
  | "ASSET_PREFETCH_FAILED"
  | "ASSET_CACHE_FAILED"
  | "ASSET_NOT_PREPARED"
  | "UNKNOWN";

const defaultMessages: Record<WorkflowErrorCode, string> = {
  HTTPS_REQUIRED: "WebUSB chỉ chạy trên HTTPS hoặc localhost.",
  WEBUSB_UNAVAILABLE: "Trình duyệt không hỗ trợ WebUSB. Hãy dùng Chrome hoặc Edge desktop.",
  USB_PICKER_CANCELLED: "Bạn đã hủy chọn thiết bị USB.",
  DEVICE_NOT_FOUND: "Không thấy thiết bị. Kiểm tra cáp, driver USB và chế độ Fastboot/ADB/EDL.",
  UNSUPPORTED_PRODUCT: "Codename máy không nằm trong danh sách hỗ trợ v1.",
  WRONG_PRODUCT: "Product hiện tại không khớp mẫu máy đã khóa.",
  ADB_UNAUTHORIZED: "ADB chưa được cấp quyền. Mở khóa màn hình và bấm Cho phép ở hộp RSA.",
  SELINUX_NOT_PERMISSIVE: "SELinux không ở trạng thái Permissive, dừng để tránh ghi ABL sai ngữ cảnh.",
  HASH_MISMATCH: "Hash tệp tải về không khớp danh sách SHA-256. Không flash tệp này.",
  FASTBOOT_FAILED: "Fastboot trả lời lỗi khi chạy lệnh.",
  USB_DISCONNECTED: "USB bị ngắt giữa chừng. Cắm lại và dùng nút reconnect.",
  ANTIROLLBACK_FAILED: "Antirollback của máy cao hơn package, không được flash gói này.",
  CONFIRMATION_REQUIRED: "Cần tick xác nhận cho bước phá dữ liệu trước khi chạy.",
  MANIFEST_INVALID: "Danh sách tệp không đúng schema.",
  ASSET_FETCH_FAILED: "Không tải được tệp từ máy chủ asset.",
  ASSET_PREFETCH_FAILED: "Không thể tải và kiểm tra đủ tệp trước khi flash.",
  ASSET_CACHE_FAILED: "Không thể đọc/ghi tệp vào bộ nhớ đệm trình duyệt.",
  ASSET_NOT_PREPARED: "Tệp chưa được chuẩn bị trong phiên hiện tại.",
  UNKNOWN: "Lỗi chưa phân loại.",
};

export class WorkflowError extends Error {
  readonly code: WorkflowErrorCode;
  readonly detail?: unknown;

  constructor(code: WorkflowErrorCode, message = defaultMessages[code], detail?: unknown) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
    this.detail = detail;
  }
}

export const toWorkflowError = (error: unknown, fallback: WorkflowErrorCode = "UNKNOWN") => {
  if (error instanceof WorkflowError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return new WorkflowError("USB_PICKER_CANCELLED", undefined, error);
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("unauthorized") || message.includes("auth")) {
      return new WorkflowError("ADB_UNAUTHORIZED", defaultMessages.ADB_UNAUTHORIZED, error);
    }

    if (message.includes("hash mismatch")) {
      return new WorkflowError("HASH_MISMATCH", error.message, error);
    }

    if (message.includes("quota") || message.includes("indexeddb") || message.includes("browser cache")) {
      return new WorkflowError("ASSET_CACHE_FAILED", error.message, error);
    }

    if (message.includes("not prepared")) {
      return new WorkflowError("ASSET_NOT_PREPARED", error.message, error);
    }

    if (message.includes("disconnected") || message.includes("transfer")) {
      return new WorkflowError("USB_DISCONNECTED", defaultMessages.USB_DISCONNECTED, error);
    }

    if (message.includes("bootloader replied") || message.includes("fastboot")) {
      return new WorkflowError("FASTBOOT_FAILED", error.message, error);
    }

    return new WorkflowError(fallback, error.message, error);
  }

  return new WorkflowError(fallback, defaultMessages[fallback], error);
};

export const errorAdvice: Record<WorkflowErrorCode, string> = {
  HTTPS_REQUIRED: "Triển khai qua Cloudflare Pages hoặc chạy localhost khi kiểm thử.",
  WEBUSB_UNAVAILABLE: "Không dùng Firefox/Safari; trên Windows cần driver USB expose được interface WebUSB.",
  USB_PICKER_CANCELLED: "Bấm kết nối lại và chọn đúng thiết bị trong hộp chọn của trình duyệt.",
  DEVICE_NOT_FOUND: "Đưa máy về đúng mode: Fastboot, ADB Android hoặc Qualcomm 9008 tùy workflow đang chọn.",
  UNSUPPORTED_PRODUCT: "Không tiếp tục với mẫu máy ngoài danh sách hỗ trợ của flow đang chọn.",
  WRONG_PRODUCT: "Ngắt kết nối, đưa đúng máy về Fastboot và kết nối lại.",
  ADB_UNAUTHORIZED: "Rút cắm lại nếu hộp xác nhận không hiện, sau đó bấm Cho phép trên màn hình điện thoại.",
  SELINUX_NOT_PERMISSIVE: "Quay lại Fastboot và chạy lại Boot Android Permissive trước khi ghi ABL qua MQSAS.",
  HASH_MISMATCH: "Kiểm tra lại tệp asset đã upload và sha256sums.json trước khi thử lại.",
  FASTBOOT_FAILED: "Không thử lại mù. Đọc dòng lệnh cuối trong nhật ký và kiểm tra cáp/đúng chế độ.",
  USB_DISCONNECTED: "Sau reboot hoặc đổi mode, bấm reconnect rồi chọn lại thiết bị.",
  ANTIROLLBACK_FAILED: "Dừng quy trình; package hạ cấp không an toàn cho antirollback hiện tại.",
  CONFIRMATION_REQUIRED: "Tick xác nhận riêng của bước hiện tại rồi chạy tiếp.",
  MANIFEST_INVALID: "Tạo lại manifest bằng script build asset.",
  ASSET_FETCH_FAILED: "Kiểm tra VITE_ASSET_BASE_URL, CORS và đường dẫn public object.",
  ASSET_PREFETCH_FAILED: "Dừng quy trình, kiểm tra máy chủ asset/CORS/sha256sums.json rồi chạy lại bước chuẩn bị tệp ROM.",
  ASSET_CACHE_FAILED: "Kiểm tra dung lượng lưu trữ trình duyệt/IndexedDB. Xóa bộ nhớ đệm site nếu cần và chuẩn bị lại.",
  ASSET_NOT_PREPARED: "Chạy lại bước chuẩn bị tệp ROM; các bước flash không được tải mạng trực tiếp.",
  UNKNOWN: "Tải nhật ký xuống và kiểm tra stack/thông báo chi tiết.",
};
