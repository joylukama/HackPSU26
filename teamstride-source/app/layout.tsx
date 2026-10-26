import "./globals.css";
export const viewport={width:'device-width',initialScale:1};
export const metadata = {icons:{icon:[{url:"/favicon.svg?v=teamstride-logo-1",type:"image/svg+xml"}]},title:"Teamstride — Make progress, together",description:"Turn a big project into small wins. Plan tasks, balance your team and track progress."};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}