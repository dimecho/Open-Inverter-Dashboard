<?php
	//session_start();
	set_time_limit(10000);
	
    error_reporting(E_ALL);
    ini_set('display_errors', true);
	
    $com = "/dev/ttyUSB0";

    if (!file_exists($com)) {
        $com = "/dev/ttyAMA0";
    }
    
    if(!isset($_SESSION["serial"])) {

        exec("minicom -b 115200 -o -D " .$com. " &");
        exec("killall minicom");
        
        $_SESSION["serial"] = 1;
    }
	
	if(isset($_GET["phpinfo"]))
	{
		phpinfo();
	}
	else if(isset($_GET["get"]))
	{
		if(strpos($_GET["get"],",") !== false) //Multi-value support
		{
			$split = explode(",",$_GET["get"]);
			for ($x = 0; $x < count($split); $x++)
				echo readSerial("get " .$split[$x]). "\n";
		}else{
			echo readSerial("get " .$_GET["get"]);
		}
        
        if(strpos($_GET["get"],"rfid") !== false && isset($_SESSION["rfid"]))
            echo $_SESSION["rfid"]. "\n";
	}
	else if(isset($_GET["stream"]))
	{
		//ini_set('zlib.output_compression', 0);
		//ini_set('output_buffering', 0);
		
		header('Content-Type: text/plain; charset=utf-8');
		
		ob_end_flush();
		for ($i = 0; $i<10; $i++){
			echo readSerial("get " .$_GET["stream"]); 
			sleep(1);
		}
		ob_start();
	}
	else if(isset($_GET["command"]))
	{
		echo readSerial($_GET["command"]);
	}
	else if(isset($_GET["average"]))
	{
		echo calculateAverage(readArray($_GET["average"],6));
	}
	else if(isset($_GET["median"]))
	{
		echo calculateMedian(readArray($_GET["median"],3));
	}
    
    function readSerial($cmd)
    {
		$cmd = urldecode($cmd). "\n";
		$uart = fopen($GLOBALS["com"], "r+"); //Read & Write
		
		fwrite($uart, $cmd);
        
		$read = "";
		while($read .= fread($uart, 1)) //stream_get_contents($uart)
        {
            if(strpos($read,$cmd) !== false) //Reached end of echo
            {
                $read = "";
                //TODO: command=errors
           
				while($read .= fread($uart, 1))
					if(strpos($read,"\n") !== false)
						break;
                $read = rtrim($read ,"\n");
                break;
            }
		}
		
		fclose($uart);
        return $read;
    }

    function calculateMedian($arr)
    {
        $count = count($arr); // total numbers in array
        $middleval = floor(($count-1)/2); // find the middle value, or the lowest middle value

        if($count % 2) { // odd number, middle is the median
            $median = $arr[$middleval];
        } else { // even number, calculate avg of 2 medians
            $low = $arr[$middleval];
            $high = $arr[$middleval+1];
            $median = (($low+$high)/2);
        }
        return round($median,2);
    }

    function calculateAverage($arr)
    {
        $count = count($arr); // total numbers in array
        foreach ($arr as $value) {
            $total = $total + $value; // total value of array numbers
        }
        $average = ($total/$count); // get average value
        return round($average,2);
    }
?>