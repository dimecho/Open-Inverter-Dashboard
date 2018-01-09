<?php
   
    header("Access-Control-Allow-Origin: *");

	set_time_limit(160);

    error_reporting(E_ERROR | E_PARSE);
	
    $com = "/dev/ttyUSB0";

    if (!file_exists($com)) {
        $com = "/dev/ttyAMA0";
    }
    
    if(isset($_GET["init"]))
    {
        exec("minicom -b 115200 -o -D " .$com. " &");
        exec("killall minicom");

        $uart = fopen($com, "r+");
        $read = "";
        
        if($uart) {
            //Unknown command sequence
            //--------------------
            fwrite($uart, "hello\r");

            while($read .= fread($uart, 1))
                if(strpos($read,"\n") !== false)
                    break;
           
            fclose($uart);
            //--------------------

            echo $read;

        }else{
            echo "Error: Cannot open ". $com;
        }
    }
	
	if(isset($_GET["get"]))
	{
		echo readSerial("get " .$_GET["get"]);
		
        if(strpos($_GET["get"],"rfid") !== false && isset($_SESSION["rfid"]))
            echo $_SESSION["rfid"]. "\n";
	}
	else if(isset($_GET["stream"]))
	{
		//ini_set('zlib.output_compression', 0);
		//ini_set('output_buffering', 0);
		
		//header('Content-Type: text/plain');
		
        ob_end_flush();
  
        if(isset($_GET["loop"]))
        {
            $l = intval($_GET["loop"]);
            for ($i = 0; $i < $l; $i++)
            {
                streamSerial("get " .$_GET["stream"]);
                //sleep(1);
            }
        }else{
            streamSerial("get " .$_GET["stream"]);
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
		$cmd = urldecode($cmd). "\r";
		$uart = fopen($GLOBALS["com"], "r+"); //Read & Write
        stream_set_blocking($uart, 1); //O_NONBLOCK
        stream_set_timeout($uart, 8);

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

                $read = rtrim($read ,"\r");
                $read = rtrim($read ,"\n");
                break;
            }
		}
		
		fclose($uart);
        return $read;
    }

    function streamSerial($cmd)
    {
        $cmd = urldecode($cmd). "\r";
        $uart = fopen($GLOBALS["com"], "r+"); //Read & Write
        stream_set_blocking($uart, 1); //O_NONBLOCK
        stream_set_timeout($uart, 8);

        fwrite($uart, $cmd);
        
        $streamCount = 0;
        $streamLength = substr_count($cmd, ',');
        $read = "";

        while($read .= fread($uart, 1)) //stream_get_contents($uart)
        {
            if(strpos($read,$cmd) !== false) //Reached end of echo
            {
                //echo $read;
                $read = "";
                
                while($streamCount <= $streamLength)
                {
                    $read .= fread($uart, 1);

                    if(strpos($read,"\n") !== false)
                    {
                        //echo $streamCount. "-". $streamLength. " " . $read;
                        echo $read;

                        $read = "";
                        $streamCount += 1;

                        if($streamCount > $streamLength)
                            break;
                    }
                }
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