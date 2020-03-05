<?php

    if(isset($_GET["init"]))
    {
       echo "(No Hardware)";
    }
    else if(isset($_GET["stream"]))
    {
        echo "0," .rand(50, 60). ",40," .rand(5, 45). ",0,0,0";
   	}
    else if(isset($_GET["read"]))
    {
    	echo "v:" .rand(50, 200). ",b:" .rand(50, 200). ",n:" .rand(50, 200). ",i:" .rand(5, 45). ",p:"  .rand(50, 60). ",ah:" .rand(50, 60). ",kwh:" .rand(50, 60). ",t:" .rand(30, 60). "*";
    }
?>