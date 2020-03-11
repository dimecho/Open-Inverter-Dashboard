<?php

	if(isset($_POST["view"]) && isset($_POST["json"]))
	{
        $json = json_decode($_POST["json"]);
        $path = str_replace("views/", "", $_POST["view"]);
	    $file = fopen($path,"w") or die("Cannot open file: " .$path);
        fwrite($file,json_encode($json, JSON_PRETTY_PRINT));
        fclose($file);
	}
    else if(isset($_POST["odometer"]))
    {

    }
?>