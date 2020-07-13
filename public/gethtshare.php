<?php
/**
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/> for a copy of the
 * CC0 Public Domain Dedication.
**/
header('Access-Control-Allow-Origin: *');
header( 'Content-Type: application/json' );
include('../connect.inc.php');

$result = mysqli_query($conn2, 'SELECT para FROM ht_share WHERE id = "'.$_GET['htid'].'"');
$row = mysqli_fetch_assoc($result);
parse_str($row['para'], $para);
echo json_encode( $para );
?>
