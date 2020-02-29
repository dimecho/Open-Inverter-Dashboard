<?php

    if(isset($_GET["init"]))
    {
       echo "(No Hardware)";
    }
    else if(isset($_GET["stream"]))
    {
        echo "0," .rand(50, 60). ",40," .rand(5, 45). ",0,0,0";
    }
?>