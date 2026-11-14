package co.muzcast.setup;
import java.io.*;
import java.net.*;
import javax.net.ssl.*;
import org.json.JSONObject;
/** Direct DoT queries: never changes Android settings. No account or user data. */
public final class DnsProbe {
 static String stage="resolve";
 static byte[] query() throws Exception {
  ByteArrayOutputStream b=new ByteArrayOutputStream(); DataOutputStream d=new DataOutputStream(b);
  d.writeShort(19799); d.writeShort(256); d.writeShort(1);d.writeShort(0);d.writeShort(0);d.writeShort(0);
  for(String label:"www.muzcast.co".split("\\.")){byte[] v=label.getBytes("US-ASCII");d.writeByte(v.length);d.write(v);}
  d.writeByte(0);d.writeShort(1);d.writeShort(1);return b.toByteArray();
 }
 public static void main(String[] args) throws Exception {
  JSONObject out=new JSONObject(); long start=System.currentTimeMillis();
  try {
   if(args.length!=1||!args[0].matches("[a-zA-Z0-9.-]{1,253}"))throw new IOException("input");
   String host=args[0];
   if(host.equals("system")) {
    stage="https"; HttpURLConnection h=(HttpURLConnection)new URL("https://www.muzcast.co/").openConnection();
    h.setConnectTimeout(5000);h.setReadTimeout(5000);try{int code=h.getResponseCode();if(code<200||code>=400)throw new IOException("http");}finally{h.disconnect();}
   } else {
    InetAddress[] addresses=InetAddress.getAllByName(host);
    Exception last=null; boolean success=false;
    // Test usable IPv4 first; IPv6 is still tested when IPv4 is unavailable.
    for(int i=0;i<addresses.length;i++)for(int j=i+1;j<addresses.length;j++)if(addresses[i] instanceof Inet6Address && addresses[j] instanceof Inet4Address){InetAddress a=addresses[i];addresses[i]=addresses[j];addresses[j]=a;}
    for(int i=0;i<Math.min(4,addresses.length);i++) {
     try(Socket socket=new Socket()) {
      stage="tcp";socket.connect(new InetSocketAddress(addresses[i],853),3000);socket.setSoTimeout(4000);
      stage="tls";
      try(SSLSocket tls=(SSLSocket)((SSLSocketFactory)SSLSocketFactory.getDefault()).createSocket(socket,host,853,true)) {
       SSLParameters params=tls.getSSLParameters();params.setEndpointIdentificationAlgorithm("HTTPS");tls.setSSLParameters(params);tls.setSoTimeout(4000);tls.startHandshake();
       stage="dns";byte[] q=query();DataOutputStream writer=new DataOutputStream(tls.getOutputStream());writer.writeShort(q.length);writer.write(q);writer.flush();
       DataInputStream reader=new DataInputStream(tls.getInputStream());int n=reader.readUnsignedShort();if(n<12||n>4096)throw new IOException("length");byte[] r=new byte[n];reader.readFully(r);
       if((r[0]&255)!=77||(r[1]&255)!=87||(r[2]&128)==0||(r[3]&15)!=0||((r[6]&255)*256+(r[7]&255))==0)throw new IOException("answer");
       success=true;break;
      }
     }catch(Exception e){last=e;}
    }
    if(!success)throw last==null?new IOException("address"):last;
   }
   out.put("ok",true);out.put("stage","complete");
  }catch(Exception e){out.put("ok",false);out.put("stage",stage);out.put("error",e.getClass().getSimpleName());}
  out.put("elapsedMs",System.currentTimeMillis()-start);System.out.println(out.toString());
 }
}
