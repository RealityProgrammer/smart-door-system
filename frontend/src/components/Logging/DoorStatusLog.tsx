import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {useCallback, useEffect, useState} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {apiService} from "@/services/api";
import {DeviceLog, SuspiciousInfo} from "@/types";
import ReactPaginate from "react-paginate";

export function DoorStatusLog() {
  const itemsPerPage = 10;

  const [openModal, setOpenModal] = useState<boolean>();
  const [logs, setLogs] = useState<DeviceLog[] | null | "error">(null);

  // TODO: Server-side pagination.

  // Pagination properties.
  const [itemOffset, setItemOffset] = useState(0);
  const [paginateItems, setPaginateItems] = useState<DeviceLog[] | null>(null);

  useEffect(() => {
    if (!openModal) return;

    async function startFetching() {
      console.log("startFetching");

      setLogs(null);
      const result = await apiService.getDeviceLogs();

      if (!ignore) {
        if (Array.isArray(result)) {
          setLogs(result);
          setPaginateItems(result.slice(itemOffset, itemOffset + itemsPerPage));
        } else {
          setLogs("error");
        }
      }
    }

    let ignore = false;
    startFetching();
    return () => {
      ignore = true;
    }
  }, [openModal]);

  const handlePaginationChange = (event: { selected: number }) => {
    if (!Array.isArray(logs)) return;

    const newOffset = (event.selected * itemsPerPage) % logs.length;
    setItemOffset(newOffset);
    setPaginateItems(logs.slice(newOffset, newOffset + itemsPerPage));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Nhật ký trạng thái cửa
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              Xem
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2/3">
            <DialogHeader>
              <DialogTitle>Nhật ký trạng thái</DialogTitle>
            </DialogHeader>

            { Array.isArray(logs) && (
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3">
                        ID Thiết bị
                      </th>
                      <th scope="col" className="px-6 py-3">
                        Trạng thái
                      </th>
                      <th scope="col" className="px-6 py-3">
                        Thời gian thiết bị
                      </th>
                      <th scope="col" className="px-6 py-3">
                        Thời gian máy chủ
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    { Array.isArray(paginateItems) && paginateItems.map(row => (
                      <tr className="bg-white border-b" key={row.id}>
                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                          { row.id }
                        </th>
                        <td className="px-6 py-4">
                          {
                            {
                              'open': 'Mở',
                              'closed': 'Đóng',
                              'attacked': 'Bị tấn công',
                              'suspicious': 'Nghi ngờ',
                            }[row.door_status] || row.door_status
                          }
                        </td>
                        <td className="px-6 py-4">
                          { row.device_timestamp }
                        </td>
                        <td className="px-6 py-4">
                          { new Date(row.server_timestamp).toISOString() }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-3 flex justify-center items-center">
                  <ReactPaginate
                    breakLabel="..."
                    previousLabel={(
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-6">
                        <path
                          d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
                          clipRule="evenodd" fillRule="evenodd"/>
                      </svg>
                    )}
                    nextLabel={(
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-6">
                        <path
                          d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                          clipRule="evenodd" fillRule="evenodd"/>
                      </svg>
                    )}
                    pageCount={Math.ceil(logs.length / itemsPerPage)}
                    onPageChange={handlePaginationChange}
                    pageRangeDisplayed={5}
                    renderOnZeroPageCount={null}
                    pageClassName="page-item"
                    pageLinkClassName="page-link"
                    previousClassName="page-item"
                    previousLinkClassName="page-link"
                    nextClassName="page-item"
                    nextLinkClassName="page-link"
                    breakClassName="page-item"
                    breakLinkClassName="page-link"
                    containerClassName="pagination"
                    activeClassName="active"
                  />
                </div>
              </div>
            )}

            { !logs && "Đang tải dữ liệu..." }
            { logs == 'error' && "Đã xảy ra lỗi! Vui lòng thử lại!" }
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}