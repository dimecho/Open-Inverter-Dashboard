<?php

	if(isset($_POST["view"]) && isset($_POST["json"]))
	{
        $json = json_decode($_POST["json"]);
	    $file = fopen($_POST["view"],"w") or die("Cannot open file: " .$_POST["view"]);
        fwrite($file,json_encode($json, JSON_PRETTY_PRINT));
        fclose($file);
	}
    else if(isset($_POST["odometer"]))
    {

    }
?>