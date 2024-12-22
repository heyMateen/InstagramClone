document.querySelector("#file").addEventListener("change", function () {
  const fileInput = this;
  const file = fileInput.files[0];

  if (file) {
    const reader = new FileReader();

    reader.onload = function (event) {
      document.querySelector("#profile_image").src = event.target.result;
    };

    reader.readAsDataURL(file);
  }
});
