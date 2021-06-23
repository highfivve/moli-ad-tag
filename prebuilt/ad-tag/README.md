# Prebuilt AdTag

This AdTag is served without configuration and modules. That enables you to easily play around with the configuration and slots definition.

You can easily configure the ad tag:

```
<script src="https://assets.h5v.eu/adtags/3.14.0/tag.js" async></script>
<script>
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moli) {
   // custom configuration here
   moli.configure({  slots: []  });
   moli.requestAds();
});
</script>
```
