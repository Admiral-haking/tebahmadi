"use client";

import DatePicker from "react-multi-date-picker";
import "react-multi-date-picker/styles/colors/green.css";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type PersianDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  className?: string;
};

/** شمسی در رابط کاربر، ISO میلادی در state و API. */
export function PersianDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  name,
  className,
}: PersianDatePickerProps) {
  return (
    <DatePicker
      value={value ? new Date(`${value}T12:00:00`) : ""}
      onChange={(date) => onChange(date ? isoDate(date.toDate()) : "")}
      calendar={persian}
      locale={persian_fa}
      calendarPosition="bottom-right"
      format="YYYY/MM/DD"
      placeholder={placeholder}
      inputClass={className}
      containerClassName="persian-date-picker"
      name={name}
      digits={["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"]}
      weekDays={[["شنبه", "ش"], ["یکشنبه", "ی"], ["دوشنبه", "د"], ["سه‌شنبه", "س"], ["چهارشنبه", "چ"], ["پنجشنبه", "پ"], ["جمعه", "ج"]]}
    />
  );
}
