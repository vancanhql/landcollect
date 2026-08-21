# Cập nhật thửa đất

Ứng dụng web chạy trên điện thoại để quản lý dự án khảo sát thửa đất.

## Chức năng chính

- Tạo, xem, sửa, xóa dự án khảo sát.
- Mỗi dự án có danh sách thửa đất riêng.
- Thu thập thông tin thửa đất theo từng bước: thông tin chung, hiện trạng, tọa độ GPS, ảnh hiện trạng, kiểm tra và lưu.
- Chọn vị trí bằng GPS hoặc chạm trực tiếp trên bản đồ.
- Chỉ hiển thị bản đồ khi người dùng chọn xem bản đồ.
- Xem một thửa đất hoặc toàn bộ dự án trên bản đồ.
- Xuất GeoJSON theo từng dự án, có thể kèm ảnh hiện trạng.
- Dữ liệu được lưu trên chính thiết bị bằng `localStorage`.

## Chạy trên điện thoại

GPS và camera cần HTTPS. Cách đơn giản nhất là đưa ứng dụng lên GitHub Pages:

1. Tạo repository trên GitHub.
2. Tải toàn bộ file trong thư mục này lên repository.
3. Vào `Settings` → `Pages`.
4. Chọn `Deploy from a branch`, branch `main`, folder `/root`.
5. Mở đường dẫn GitHub Pages trên điện thoại.

## Lưu ý dữ liệu

Dữ liệu đang lưu cục bộ trên từng thiết bị. Trước khi đổi máy, xóa dữ liệu trình duyệt hoặc cài lại ứng dụng, anh nên xuất GeoJSON để sao lưu.

## Bản đồ nền

Ứng dụng có các lớp bản đồ nền:

- Vệ tinh: Google satellite tile.
- Topo: OpenTopoMap.
- Đường phố: OpenStreetMap.

Nếu dùng công khai hoặc lâu dài, anh nên kiểm tra điều khoản dịch vụ bản đồ nền. Phương án ổn định hơn là thay lớp vệ tinh bằng nhà cung cấp có tile/API key hợp lệ cho dự án.
