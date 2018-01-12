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

        $errors = shell_exec("stty -F " .$com. " 115200 -parenb -ocrnl cs8 cstopb");
        if($errors != "")
            return $errors;

        $uart = fopen($com, "r+");
        
        if($uart) {
            //Unknown command sequence
            //--------------------
            fwrite($uart, "hello\n");
            echo fgets($uart);
            echo fgets($uart);
            fclose($uart);
            //--------------------

        }else{
            echo "Error: Cannot open ". $com;
        }
    }else if(isset($_GET["reset"])) {

        if(isset($_GET["pid"]))
            exec("kill -9 " .$_GET["pid"]);
        
        exec("php -S 0.0.0.0:8081 -t /var/www/html/ > /dev/null 2>&1 &");
        exit();

    }else if(isset($_GET["stream"])) {

        $l = 1; //loop
        $t = 0; //delay

        if(isset($_GET["loop"]))
            $l = intval($_GET["loop"]);
        if(isset($_GET["delay"]))
            $t = intval($_GET["delay"]);

        streamSerial("get " .$_GET["stream"], $l, $t);
    }
    else if(isset($_GET["command"]))
    {
        echo readSerial($_GET["command"]);
    }
    
    function readSerial($cmd)
    {
        $cmd = urldecode($cmd). "\n";
        $uart = fopen($GLOBALS["com"], "r+"); //Read & Write

        fwrite($uart, $cmd);
        $read = fgets($uart); //echo
        $read = fgets($uart);

        $read = rtrim($read ,"\n");
        $read = rtrim($read ,"\r");
   
        fclose($uart);
        return $read;
    }

    function streamSerial($cmd,$loop,$delay)
    {
        $streamLength = substr_count($cmd, ',');
        $cmd = urldecode($cmd) . "\n";
        $uart = fopen($GLOBALS["com"], "r+"); //Read & Write

        fwrite($uart, $cmd);
        $read = fgets($uart); //echo

        echo getmypid(). "\n";

        for ($i = 0; $i < $loop; $i++)
        {
            $streamCount = 0;
            fwrite($uart, "!");

            ob_end_flush();
            while($streamCount <= $streamLength)
            {
                $read = fgets($uart);
                $read = ltrim($read, "!");

                echo str_replace("\r","",$read);
                
                usleep($delay);
                $streamCount++;
            }
            ob_start();
        }

        fclose($uart);
    }
?>